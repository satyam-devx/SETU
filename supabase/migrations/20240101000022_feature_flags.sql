-- ═══════════════════════════════════════════════════════════════
-- Migration 022: Feature Flags (instant enable/disable, no deploy)
--
-- Lets the admin panel turn modules on/off platform-wide instantly,
-- with optional staged rollout (%) and audience targeting (by role).
-- Authorization is via the dynamic RBAC permission 'feature_flags.manage'
-- (migration 021); super_admin implicitly holds it. Every change is
-- audit-logged with old→new.
--
-- Evaluation is server-authoritative (is_feature_enabled) so backend
-- RPCs/Edge Functions can gate too; the UI reads its evaluated set via
-- my_feature_flags().
-- ═══════════════════════════════════════════════════════════════

create table if not exists feature_flags (
  key             text primary key,
  name            text not null,
  description     text,
  enabled         boolean not null default true,
  rollout_percent integer not null default 100 check (rollout_percent between 0 and 100),
  -- audience: optional targeting, e.g. {"roles": ["customer","vendor"]}
  -- null / no "roles" key ⇒ everyone.
  audience        jsonb,
  is_system       boolean not null default true,
  updated_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_feature_flags_updated_at before update on feature_flags
  for each row execute function update_updated_at();

-- ── Seed the platform's known feature modules (all on by default) ──
insert into feature_flags (key, name, description) values
  ('wallet',          'Wallet',           'SETU Wallet balance & payments'),
  ('ai',              'AI Assistant',     'Claude-powered in-app assistant'),
  ('credit',          'SETU Credit',      'BNPL credit line & discounts'),
  ('referral',        'Referrals',        'Customer referral programme'),
  ('coupons',         'Coupons',          'Discount coupons at checkout'),
  ('payments',        'Online Payments',  'Razorpay UPI/online payments'),
  ('delivery',        'Delivery',         'Rider delivery network'),
  ('maps',            'Maps',             'Map / live tracking features'),
  ('chat',            'Chat',             'In-app chat/support messaging'),
  ('voice_assistant', 'Voice Assistant',  'Voice-based ordering')
on conflict (key) do nothing;

-- ── Server-authoritative evaluation ─────────────────────────────
-- Returns whether a feature is ON for the CURRENT caller.
-- Rules: unknown flag ⇒ true (not gated); disabled ⇒ false; audience
-- role filter (if set) must match; rollout_percent applies a stable
-- per-user bucket. Backend/service callers (auth.uid() null) ⇒ on.
create or replace function is_feature_enabled(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f feature_flags%rowtype;
begin
  select * into f from feature_flags where key = p_key;
  if not found then return true; end if;          -- unknown ⇒ not gated
  if not f.enabled then return false; end if;

  if f.audience ? 'roles' and jsonb_array_length(f.audience->'roles') > 0 then
    if not (f.audience->'roles' ? coalesce(get_my_role(), '')) then
      return false;
    end if;
  end if;

  if f.rollout_percent >= 100 then return true; end if;
  if f.rollout_percent <= 0   then return false; end if;
  if auth.uid() is null       then return true; end if; -- service/backend
  return (abs(hashtext(p_key || auth.uid()::text)) % 100) < f.rollout_percent;
end;
$$;
grant execute on function is_feature_enabled(text) to anon, authenticated, service_role;

-- The caller's evaluated flag set — the UI loads this once. Returns
-- [{key, enabled}] so the client can distinguish "off" from "unknown".
create or replace function my_feature_flags()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('key', key, 'enabled', is_feature_enabled(key)) order by key),
    '[]'::jsonb
  )
  from feature_flags;
$$;
grant execute on function my_feature_flags() to anon, authenticated, service_role;

-- ── Audited management RPCs (feature_flags.manage) ──────────────
create or replace function set_feature_flag(p_key text, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_old boolean;
begin
  if not has_permission('feature_flags.manage') then
    raise exception 'Unauthorized: feature_flags.manage required';
  end if;
  select enabled into v_old from feature_flags where key = p_key;
  if not found then raise exception 'Unknown feature flag: %', p_key; end if;

  update feature_flags
     set enabled = p_enabled, updated_by = auth.uid(), updated_at = now()
   where key = p_key;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          case when p_enabled then 'feature_flag_enabled' else 'feature_flag_disabled' end,
          p_key, format('enabled: %s → %s', v_old, p_enabled));

  return jsonb_build_object('success', true, 'key', p_key, 'enabled', p_enabled);
end;
$$;
grant execute on function set_feature_flag(text, boolean) to authenticated;

create or replace function upsert_feature_flag(
  p_key         text,
  p_name        text,
  p_description text    default null,
  p_enabled     boolean default true,
  p_rollout     integer default 100,
  p_audience    jsonb   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  insert into feature_flags (key, name, description, enabled, rollout_percent, audience, is_system, updated_by, updated_at)
  values (p_key, coalesce(p_name, p_key), p_description, p_enabled, p_rollout, p_audience, false, auth.uid(), now())
  on conflict (key) do update
    set name = excluded.name, description = excluded.description, enabled = excluded.enabled,
        rollout_percent = excluded.rollout_percent, audience = excluded.audience,
        updated_by = auth.uid(), updated_at = now();

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'feature_flag_upsert', p_key, format('enabled=%s rollout=%s', p_enabled, p_rollout));

  return jsonb_build_object('success', true, 'key', p_key);
end;
$$;
grant execute on function upsert_feature_flag(text, text, text, boolean, integer, jsonb) to authenticated;

-- ── RLS: full-row reads for admins; writes via RPC only ─────────
alter table feature_flags enable row level security;
drop policy if exists "feature_flags_admin_read" on feature_flags;
create policy "feature_flags_admin_read" on feature_flags for select using (is_admin());
-- Non-admins never read the table directly; they get their evaluated
-- set via my_feature_flags() (security definer). No write policy → all
-- client writes denied; set_feature_flag/upsert_feature_flag are the writers.

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'ops_migration', 'feature_flags',
  'migration_022: feature flags — is_feature_enabled/my_feature_flags evaluation, audited set_feature_flag/upsert_feature_flag (feature_flags.manage), RLS read-for-admins/write-via-RPC'
);
