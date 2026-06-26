-- ═══════════════════════════════════════════════════════════════
-- Migration 036: add audit_log.target_type
--
-- ROOT CAUSE:
--   audit_log is created in 000001 with columns
--   (id, actor_id, actor, action, target, detail, ip, created_at).
--   000011 re-declares it WITH a target_type column, but its
--   `create table if not exists` is a no-op (000001 already made the
--   table), so target_type was never actually added.
--
--   Meanwhile several SECURITY DEFINER admin RPCs insert into audit_log
--   WITH target_type — ban_user/unban_user (025) and
--   block_ip/unblock_ip/force_logout/merge_user_accounts/
--   begin_impersonation (030). These never failed before only because
--   the functions had never successfully executed (banning, etc. was
--   blocked upstream). Now that they run, the missing column raises
--   42703 ("column target_type does not exist").
--
-- FIX: add the column. Nullable text — functions that don't set it
-- (the majority) simply leave it NULL. Idempotent.
-- ═══════════════════════════════════════════════════════════════

alter table audit_log add column if not exists target_type text;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'audit_log',
  'migration_036: added audit_log.target_type (000011 re-declared it but its create-if-not-exists was a no-op); unblocks ban_user/block_ip/merge_user_accounts/begin_impersonation inserts.'
);
