-- ═══════════════════════════════════════════════════════════════
-- Migration 025: Security Center + Audit Log hardening
--
-- Fixes three real defects and adds the Security Center backend:
--
--  1. BAN WAS CONFLATED WITH is_verified.
--     ban_user set is_verified=false, so unverified users showed as
--     "Banned" and banning a user un-verified their KYC. Introduce a
--     dedicated is_banned / banned_at / ban_reason and stop touching
--     is_verified.
--
--  2. ADMIN BAN WAS BROKEN.
--     migration 013 revoked ban_user/unban_user from `authenticated`,
--     but the admin panel calls them with an admin JWT (not service_
--     role) → permission denied → banning never worked from the UI.
--     Re-gate them via the dynamic RBAC permission users.update and
--     grant to authenticated (the correct enterprise pattern).
--
--  3. AUDIT LOG WAS NOT IMMUTABLE.
--     No UPDATE/DELETE protection. Add an append-only trigger (blocks
--     all roles) and remove the direct admin INSERT policy so audit
--     rows can only be written by our security-definer functions.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Proper ban representation ────────────────────────────────
alter table profiles
  add column if not exists is_banned  boolean not null default false,
  add column if not exists banned_at  timestamptz,
  add column if not exists ban_reason text;
create index if not exists idx_profiles_is_banned on profiles(is_banned) where is_banned = true;

-- ── 2. ban_user / unban_user: RBAC-gated, sets is_banned, audited ──
create or replace function ban_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('users.update') then
    raise exception 'Unauthorized: users.update required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot ban yourself';
  end if;

  update profiles
     set is_banned = true, banned_at = now(), ban_reason = p_reason, updated_at = now()
   where id = p_user_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'ban_user', p_user_id::text, 'user', coalesce(p_reason, 'no reason given'));
end;
$$;

create or replace function unban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('users.update') then
    raise exception 'Unauthorized: users.update required';
  end if;

  update profiles
     set is_banned = false, banned_at = null, ban_reason = null, updated_at = now()
   where id = p_user_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          'unban_user', p_user_id::text, 'user', null);
end;
$$;

-- These were service_role-only (which broke the admin UI). Grant to
-- authenticated — authorization is enforced inside via has_permission.
grant execute on function ban_user(uuid, text) to authenticated;
grant execute on function unban_user(uuid)     to authenticated;

-- ── 3. Pin is_banned in the profiles self-update policy ─────────
-- (Recreates the migration-014 policy adding is_banned, so a user can't
--  PATCH their own row to unban themselves.)
drop policy if exists "profiles_own_update" on profiles;
create policy "profiles_own_update"
  on profiles for update
  using     (auth.uid() = id)
  with check (
    auth.uid() = id
    and role             = (select role             from profiles where id = auth.uid())
    and is_verified      = (select is_verified      from profiles where id = auth.uid())
    and setu_score       = (select setu_score       from profiles where id = auth.uid())
    and aadhaar_verified = (select aadhaar_verified from profiles where id = auth.uid())
    and is_banned        = (select is_banned        from profiles where id = auth.uid())
    and (
      village_id = (select village_id from profiles where id = auth.uid())
      or (select village_id from profiles where id = auth.uid()) is null
    )
  );

-- ── 4. Audit log immutability (append-only) ─────────────────────
create or replace function prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only — rows cannot be updated or deleted';
end;
$$;
drop trigger if exists trg_audit_log_immutable on audit_log;
create trigger trg_audit_log_immutable
  before update or delete on audit_log
  for each row execute function prevent_audit_log_mutation();

-- Remove the direct admin INSERT policy: audit rows are written ONLY by
-- security-definer functions (which bypass RLS), so no one can forge or
-- backdate audit entries from a client session.
drop policy if exists "audit_log_insert_admin" on audit_log;

-- ── 5. Security Center reads ────────────────────────────────────
create or replace function list_blocked_users()
returns table (id uuid, name text, phone text, role text, banned_at timestamptz, ban_reason text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, phone, role, banned_at, ban_reason
  from profiles
  where is_banned = true and (select has_permission('users.view'))
  order by banned_at desc nulls last;
$$;
grant execute on function list_blocked_users() to authenticated;

-- Security-relevant audit events (bans, role/permission changes, config
-- changes, payment anomalies) for the Security Center feed.
create or replace function get_security_events(p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when (select has_permission('users.view')) then
    coalesce((
      select jsonb_agg(row_to_json(e))
      from (
        select id, actor_id, actor, action, target, detail, created_at
        from audit_log
        where action in (
          'ban_user','unban_user','assign_role','role_created',
          'permission_granted','permission_revoked','permission_created',
          'setting_updated','feature_flag_enabled','feature_flag_disabled',
          'feature_flag_upsert','payment_amount_mismatch','payment_event_stuck'
        )
        order by created_at desc
        limit greatest(1, least(p_limit, 200))
      ) e
    ), '[]'::jsonb)
  else '[]'::jsonb end;
$$;
grant execute on function get_security_events(integer) to authenticated;

create or replace function get_security_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (has_permission('users.view') or is_admin()) then
    raise exception 'Unauthorized';
  end if;
  return jsonb_build_object(
    'blocked_users',          (select count(*) from profiles where is_banned),
    'security_events_24h',    (select count(*) from audit_log
                                where created_at > now() - interval '24 hours'
                                  and action in ('ban_user','unban_user','assign_role','permission_granted',
                                                 'permission_revoked','setting_updated','payment_amount_mismatch')),
    'payment_mismatches_24h', (select count(*) from audit_log
                                where action = 'payment_amount_mismatch' and created_at > now() - interval '24 hours'),
    'role_changes_24h',       (select count(*) from audit_log
                                where action in ('assign_role','role_created','permission_granted','permission_revoked')
                                  and created_at > now() - interval '24 hours'),
    'as_of', now()
  );
end;
$$;
grant execute on function get_security_overview() to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'profiles,audit_log',
  'migration_025: proper is_banned field (decoupled from is_verified); ban_user/unban_user re-gated to users.update + granted to authenticated (fixes broken admin ban); audit_log append-only trigger + direct-insert policy removed; list_blocked_users/get_security_events/get_security_overview'
);
