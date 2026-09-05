-- ═══════════════════════════════════════════════════════════════
-- Migration 062 (PASS 9 — P1-01): restore ban_user/unban_user
-- authenticated EXECUTE grant
--
-- PASS 8 LIVE FINDING
-- ban_user(uuid, text) and unban_user(uuid) are, right now, callable
-- only by service_role. A real super_admin RPC call was observed to
-- fail live with `42501: permission denied for function ban_user`.
--
-- ROOT CAUSE (reconstructed from the live audit_log's own timestamps,
-- confirmed by this pass re-reading both migrations directly)
-- Migration 025 correctly fixed the original service-role-only bug:
--   grant execute on function ban_user(uuid, text) to authenticated;
--   grant execute on function unban_user(uuid)     to authenticated;
-- Migration 035 ran 34 minutes later the same day, sweeping a batch
-- of "restricted RPCs" back to service_role-only to close a PUBLIC-
-- execute hole on functions that were never meant to be client-
-- callable at all. ban_user/unban_user were included in that sweep,
-- silently undoing migration 025's fix — an unintended interaction
-- between two migrations that each looked correct in isolation.
--
-- FIX
-- Grant EXECUTE back to `authenticated` only. This does NOT touch:
--   - the function bodies (re-read live this pass: has_permission
--     ('users.update') internal check, self-ban prevention, audit
--     logging, and search_path are all already present and correct)
--   - the existing service_role grant (left intact — any legitimate
--     server-side/service caller keeps working exactly as before)
--   - PUBLIC/anon (never granted, remains correctly denied)
--
-- This is the exact same shape of fix as migration 060 (assign_role),
-- and is intentionally minimal: one GRANT statement per function.
-- ═══════════════════════════════════════════════════════════════

grant execute on function ban_user(uuid, text) to authenticated;
grant execute on function unban_user(uuid)     to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'ban_user,unban_user',
  'migration_062 (PASS 9 P1-01): restored the authenticated EXECUTE grant on ban_user/unban_user, silently removed by migration 035''s PUBLIC-execute lockdown sweep 34 minutes after migration 025 first granted it. Internal authorization logic (has_permission(''users.update''), self-ban prevention, audit logging, search_path) verified unchanged and correct. service_role grant and PUBLIC/anon denial both left exactly as they were.'
);
