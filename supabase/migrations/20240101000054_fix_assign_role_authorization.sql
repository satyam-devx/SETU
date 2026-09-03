-- ═══════════════════════════════════════════════════════════════
-- Migration 054 (PASS 5 — FUNC-01): assign_role uncallable from the
-- Super Admin UI
--
-- PROBLEM (confirmed by Pass 3/4 audit)
-- assign_role(uuid, text) (migration 010) was revoked from
-- `authenticated` and granted only to `service_role` (migrations
-- 010, 013), with no later re-grant. src/lib/api.js's assignRole()
-- calls it via the ordinary Supabase client (the caller's own JWT,
-- never a service-role key) — so every call fails with a
-- permission-denied error before the function's own internal
-- `get_my_role() <> 'super_admin'` check is ever reached. The
-- Super Admin "assign role" UI is therefore completely non-functional
-- for every user, including a legitimate super_admin.
--
-- Migration 025 already fixed the identical bug for ban_user/
-- unban_user: redefine with an internal permission check, add
-- self-escalation/target-validation guards and audit logging, then
-- grant execute to `authenticated` (its own comment: "These were
-- service_role-only (which broke the admin UI). Grant to
-- authenticated — authorization is enforced inside...").
--
-- FIX
-- Apply the exact same pattern to assign_role: keep the existing
-- internal `get_my_role() = 'super_admin'` check (assign_role predates
-- the has_permission()-based RBAC layer that migration 025 used for
-- ban_user, and role assignment is intentionally reserved for
-- super_admin specifically, not merely the broader 'users.update'
-- permission — so get_my_role() is the correct, deliberately narrower
-- check here, not a regression), and additionally:
--   • reject self-assignment (a super_admin cannot change their own
--     role through this function — prevents a super_admin
--     accidentally or maliciously demoting/escalating themself)
--   • validate the target user actually exists
--   • keep the existing role-value whitelist check
--   • add `set search_path = public` (was missing before; also
--     closes part of Pass 3/4's SEC-04 finding for this function)
--   • grant execute to `authenticated` — safe now because every
--     authorization decision is made inside the function body against
--     server-side auth.uid()/get_my_role(), never against anything
--     the client supplies or claims.
-- ═══════════════════════════════════════════════════════════════

-- The original signature returned `void`; this version returns `jsonb`
-- so the frontend can surface a confirmation. Postgres's CREATE OR
-- REPLACE cannot change a function's return type, so the old
-- definition must be dropped first. No caller (src/lib/api.js's
-- assignRole()) inspects a specific field of the old void return, so
-- this is backward-compatible for every existing caller.
drop function if exists assign_role(uuid, text);

create function assign_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if get_my_role() <> 'super_admin' then
    raise exception 'Only super_admin can assign roles';
  end if;
  if p_user_id = v_uid then
    raise exception 'You cannot change your own role';
  end if;
  if p_role not in ('customer','vendor','rider','seva_provider','anchor','admin','super_admin') then
    raise exception 'Invalid role: %', p_role;
  end if;
  if not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'Target user not found';
  end if;

  update profiles set role = p_role, updated_at = now() where id = p_user_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (
    v_uid, coalesce((select name from profiles where id = v_uid), 'super_admin'),
    'assign_role', p_user_id::text, 'user', p_role
  );

  return jsonb_build_object('success', true, 'user_id', p_user_id, 'role', p_role);
end;
$$;

-- Previously service_role-only, which made the Super Admin UI's role
-- assignment feature entirely non-functional. Grant to authenticated —
-- every authorization decision (caller is super_admin, not
-- self-targeting, target exists, role is valid) is enforced inside the
-- function body above, exactly the pattern migration 025 already
-- established for ban_user/unban_user.
grant execute on function assign_role(uuid, text) to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'profiles,assign_role',
  'migration_054 (PASS 5 FUNC-01): assign_role re-gated (self-escalation block + target validation + search_path) and granted to authenticated — fixes the previously-broken Super Admin role-assignment UI, mirroring migration 025''s ban_user/unban_user fix.'
);
