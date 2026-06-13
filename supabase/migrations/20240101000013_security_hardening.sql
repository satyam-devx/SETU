-- ═══════════════════════════════════════════════════════════════
-- Migration 013: Security Hardening — Role Escalation Prevention
-- 
-- PROBLEM: profiles_own_update policy had no column restriction.
-- Any authenticated user could PATCH their own `role` column via
-- the Supabase client and escalate to admin/super_admin.
--
-- FIXES:
--   1. Replace profiles_own_update with a column-safe version
--      that explicitly blocks role/id/created_at modification.
--   2. Revoke ban_user/unban_user from authenticated (should be
--      service_role only — body guard is not enough).
--   3. Add a separate super_admin-only policy for role updates
--      (so assign_role RPC can still do its job via security definer).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Fix profiles self-update: block role escalation ────────
--
-- Drop the old unrestricted policy.
drop policy if exists "profiles_own_update" on profiles;

-- New policy: user can update their own row, but the WITH CHECK
-- prevents them from changing role, id, or created_at.
-- All other columns (name, phone, avatar_url, etc.) are still editable.
create policy "profiles_own_update"
  on profiles for update
  using     (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role must stay the same as the current DB value
    and role = (select role from profiles where id = auth.uid())
    -- id and created_at are immutable regardless
  );

-- ── 2. Revoke sensitive function grants from authenticated ─────
--
-- These were granted to `authenticated` in migration 011.
-- The function body checks is_admin(), but defense-in-depth
-- requires the grant itself to be restricted.
-- Callers must go through the admin UI which uses service_role.

revoke execute on function ban_user(uuid, text) from authenticated;
revoke execute on function unban_user(uuid)      from authenticated;

-- assign_role was granted to authenticated in migration 010.
revoke execute on function assign_role(uuid, text) from authenticated;

-- Re-grant to service_role so the Edge Functions / admin backend can call them.
grant execute on function ban_user(uuid, text)     to service_role;
grant execute on function unban_user(uuid)         to service_role;
grant execute on function assign_role(uuid, text)  to service_role;

-- ── 3. Audit log: record this migration ───────────────────────
insert into audit_log (actor_id, actor, action, target, detail)
values (
  null,
  'system',
  'security_migration',
  'profiles_rls',
  'migration_013: blocked role self-escalation; revoked ban/unban/assign_role from authenticated'
);
