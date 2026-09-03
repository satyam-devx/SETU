-- ═══════════════════════════════════════════════════════════════
-- Migration 060 (PASS 7 — Workstream 3): assign_role PUBLIC/anon
-- EXECUTE grant
--
-- PASS 6 FINDING: migration 054 (Pass 5) used `DROP FUNCTION` +
-- `CREATE FUNCTION` for assign_role (required because its return type
-- changed from void to jsonb, which CREATE OR REPLACE cannot do). A
-- freshly created function receives Postgres's default
-- `GRANT EXECUTE ... TO PUBLIC`. Migration 054 added an explicit
-- `GRANT ... TO authenticated` but never an explicit
-- `REVOKE ... FROM PUBLIC`, so the function has been executable by
-- PUBLIC — including the entirely unauthenticated `anon` role — since
-- migration 054, contrary to Pass 5's own description of the fix.
--
-- Not currently exploitable: every unauthorized caller (anonymous,
-- non-super-admin, self-targeting, invalid role, missing target) is
-- still correctly rejected by the function's own internal checks
-- (re-verified in Pass 6 §3, case-by-case). This migration closes the
-- gap anyway, for the same defense-in-depth reason every other
-- sensitive RPC in this schema is grant-restricted: the internal
-- check should not be the ONLY thing standing between an
-- unauthenticated caller and this function.
--
-- No internal authorization logic is touched — only the grant.
-- ═══════════════════════════════════════════════════════════════

revoke execute on function assign_role(uuid, text) from public, anon;
-- authenticated keeps EXECUTE (migration 054) — internal checks
-- (super_admin only, no self-escalation, valid role, valid target)
-- remain the authorization boundary for authenticated callers, exactly
-- as migration 054 and migration 025 (ban_user/unban_user) intended.

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'assign_role',
  'migration_060 (PASS 7, Workstream 3 — Pass 6 finding): assign_role''s EXECUTE grant is now explicitly revoked from PUBLIC and anon (migration 054''s DROP+CREATE had left it PUBLIC-executable by Postgres default, never explicitly revoked). authenticated retains EXECUTE, gated entirely by the function''s own internal super_admin/self-escalation/target-validation checks (unchanged). Not previously exploitable — every unauthorized caller was already rejected internally — this closes the grant-level defense-in-depth gap to match every other sensitive RPC in this schema.'
);
