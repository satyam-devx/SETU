-- ═══════════════════════════════════════════════════════════════
-- Migration 064: Feature flags hardening — kill switches + audit history
--
-- Builds on migration 022 (feature_flags, is_feature_enabled,
-- my_feature_flags, set_feature_flag, upsert_feature_flag). Adds:
--
--   • is_kill_switch — informational flag ops can set on
--     particularly critical modules; doesn't change evaluation, just
--     lets the admin UI badge/group "flip this off if it's on fire"
--     flags separately from routine feature toggles.
--   • feature_flag_audit — a structured, per-flag audit trail
--     (old/new value, actor, reason, timestamp) so admins can see a
--     flag's history without grepping the generic audit_log's
--     free-text `detail` column. Every write still ALSO logs to
--     audit_log for platform-wide consistency — this is additive,
--     not a replacement.
--   • kill_switch(key, reason) — a dedicated, reason-required RPC
--     for the emergency "turn this off right now" action, distinct
--     from a routine set_feature_flag(key, false) toggle in the
--     audit trail (action = 'kill_switch' vs 'toggle').
--   • feature_flag_history(key) — admin-only read of a flag's audit
--     trail for the UI.
-- ═══════════════════════════════════════════════════════════════

alter table feature_flags
  add column if not exists is_kill_switch boolean not null default false;

create table if not exists feature_flag_audit (
  id              uuid primary key default gen_random_uuid(),
  flag_key        text not null references feature_flags(key) on delete cascade,
  action          text not null check (action in ('create', 'toggle', 'upsert', 'kill_switch')),
  old_value       jsonb,
  new_value       jsonb,
  reason          text,
  changed_by      uuid references auth.users(id) on delete set null,
  changed_by_name text,
  changed_at      timestamptz not null default now()
);

create index if not exists feature_flag_audit_key_idx
  on feature_flag_audit (flag_key, changed_at desc);

alter table feature_flag_audit enable row level security;
drop policy if exists "feature_flag_audit_admin_read" on feature_flag_audit;
create policy "feature_flag_audit_admin_read"
  on feature_flag_audit for select using (is_admin());
-- No write policy — every insert happens inside the security-definer
-- RPCs below, never directly from a client.

-- ── set_feature_flag: now records structured audit + optional reason ──
-- The original migration-022 signature is dropped, not just replaced —
-- `create or replace` only replaces an EXACT parameter-type match, so
-- adding p_reason would otherwise create a second overload and leave
-- the old (non-auditing) one reachable via 2-arg calls.
drop function if exists set_feature_flag(text, boolean);

create or replace function set_feature_flag(p_key text, p_enabled boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old boolean;
  v_actor_name text;
begin
  if not has_permission('feature_flags.manage') then
    raise exception 'Unauthorized: feature_flags.manage required';
  end if;
  select enabled into v_old from feature_flags where key = p_key;
  if not found then raise exception 'Unknown feature flag: %', p_key; end if;

  update feature_flags
     set enabled = p_enabled, updated_by = auth.uid(), updated_at = now()
   where key = p_key;

  select coalesce(name, 'admin') into v_actor_name from profiles where id = auth.uid();

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce(v_actor_name, 'admin'),
          case when p_enabled then 'feature_flag_enabled' else 'feature_flag_disabled' end,
          p_key, format('enabled: %s → %s', v_old, p_enabled));

  insert into feature_flag_audit (flag_key, action, old_value, new_value, reason, changed_by, changed_by_name)
  values (p_key, 'toggle', jsonb_build_object('enabled', v_old), jsonb_build_object('enabled', p_enabled),
          p_reason, auth.uid(), v_actor_name);

  return jsonb_build_object('success', true, 'key', p_key, 'enabled', p_enabled);
end;
$$;
grant execute on function set_feature_flag(text, boolean, text) to authenticated;

-- ── upsert_feature_flag: now supports is_kill_switch + reason + audit ──
-- Same reasoning — drop the old 6-arg overload from migration 022
-- before creating the 8-arg version, so there's exactly one signature.
drop function if exists upsert_feature_flag(text, text, text, boolean, integer, jsonb);

create or replace function upsert_feature_flag(
  p_key            text,
  p_name           text,
  p_description    text    default null,
  p_enabled        boolean default true,
  p_rollout        integer default 100,
  p_audience       jsonb   default null,
  p_is_kill_switch boolean default false,
  p_reason         text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existed boolean;
  v_old jsonb;
  v_actor_name text;
begin
  if not has_permission('feature_flags.manage') then
    raise exception 'Unauthorized: feature_flags.manage required';
  end if;
  if p_key !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'Flag key must be lowercase snake_case';
  end if;
  if p_rollout < 0 or p_rollout > 100 then
    raise exception 'rollout must be between 0 and 100';
  end if;

  select true, to_jsonb(f) into v_existed, v_old from feature_flags f where key = p_key;

  insert into feature_flags (key, name, description, enabled, rollout_percent, audience, is_kill_switch, is_system, updated_by, updated_at)
  values (p_key, coalesce(p_name, p_key), p_description, p_enabled, p_rollout, p_audience, p_is_kill_switch, false, auth.uid(), now())
  on conflict (key) do update
    set name = excluded.name, description = excluded.description, enabled = excluded.enabled,
        rollout_percent = excluded.rollout_percent, audience = excluded.audience,
        is_kill_switch = excluded.is_kill_switch,
        updated_by = auth.uid(), updated_at = now();

  select coalesce(name, 'admin') into v_actor_name from profiles where id = auth.uid();

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce(v_actor_name, 'admin'),
          'feature_flag_upsert', p_key, format('enabled=%s rollout=%s', p_enabled, p_rollout));

  insert into feature_flag_audit (flag_key, action, old_value, new_value, reason, changed_by, changed_by_name)
  values (
    p_key, case when coalesce(v_existed, false) then 'upsert' else 'create' end,
    v_old,
    jsonb_build_object('enabled', p_enabled, 'rollout_percent', p_rollout, 'audience', p_audience, 'is_kill_switch', p_is_kill_switch),
    p_reason, auth.uid(), v_actor_name
  );

  return jsonb_build_object('success', true, 'key', p_key);
end;
$$;
grant execute on function upsert_feature_flag(text, text, text, boolean, integer, jsonb, boolean, text) to authenticated;

-- ── kill_switch: the emergency panic-button action ──────────────
-- Distinct from a routine toggle so it stands out in the audit trail.
-- Reason is mandatory — an emergency disable without a stated reason
-- helps no one debugging it later.
create or replace function kill_switch(p_key text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old boolean;
  v_actor_name text;
begin
  if not has_permission('feature_flags.manage') then
    raise exception 'Unauthorized: feature_flags.manage required';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to use the kill switch';
  end if;

  select enabled into v_old from feature_flags where key = p_key;
  if not found then raise exception 'Unknown feature flag: %', p_key; end if;

  update feature_flags
     set enabled = false, updated_by = auth.uid(), updated_at = now()
   where key = p_key;

  select coalesce(name, 'admin') into v_actor_name from profiles where id = auth.uid();

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce(v_actor_name, 'admin'), 'feature_flag_kill_switch', p_key,
          format('EMERGENCY DISABLE — reason: %s', p_reason));

  insert into feature_flag_audit (flag_key, action, old_value, new_value, reason, changed_by, changed_by_name)
  values (p_key, 'kill_switch', jsonb_build_object('enabled', v_old), jsonb_build_object('enabled', false),
          p_reason, auth.uid(), v_actor_name);

  return jsonb_build_object('success', true, 'key', p_key, 'enabled', false);
end;
$$;
grant execute on function kill_switch(text, text) to authenticated;

-- ── feature_flag_history: admin-only read of a flag's audit trail ──
create or replace function feature_flag_history(p_key text, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin required';
  end if;
  return coalesce(
    (select jsonb_agg(row_to_json(h) order by h.changed_at desc)
       from (
         select action, old_value, new_value, reason, changed_by_name, changed_at
           from feature_flag_audit
          where flag_key = p_key
          order by changed_at desc
          limit greatest(1, least(p_limit, 100))
       ) h
    ),
    '[]'::jsonb
  );
end;
$$;
grant execute on function feature_flag_history(text, integer) to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'ops_migration', 'feature_flags',
  'migration_064: feature flags hardening — is_kill_switch, structured feature_flag_audit trail, kill_switch()/feature_flag_history() RPCs, set_feature_flag/upsert_feature_flag now accept an optional reason'
);
