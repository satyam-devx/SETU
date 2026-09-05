-- ═══════════════════════════════════════════════════════════════
-- Migration 064 (PASS 9 — Part 3): rate_limit_hits direct access
-- lockdown
--
-- PASS 8 LIVE FINDING
-- rate_limit_hits has RLS DISABLED with 0 policies. This pass's own
-- re-check found the exposure is worse than Pass 8's initial SELECT-
-- only characterization: anon and authenticated both currently hold
-- SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER
-- on this table -- i.e. full direct read/write/destroy access via
-- PostgREST to any client, authenticated or not.
--
-- USAGE ANALYSIS PERFORMED BEFORE THIS MIGRATION (per instruction not
-- to assume clients need any direct access)
-- The only two things that touch this table anywhere in the schema
-- are:
--   check_rate_limit(p_key, p_max_count, p_window_seconds) -- inserts
--     a hit and counts recent hits for that key, SECURITY DEFINER.
--   prune_rate_limit_hits() -- deletes hits older than 1 day,
--     SECURITY DEFINER, cron-scheduled.
-- No frontend code, no other RPC, and no Edge Function reads or
-- writes this table directly (confirmed by repository grep). Clients
-- have no legitimate reason to touch this table directly at all --
-- every legitimate interaction already goes through the two
-- SECURITY DEFINER functions above, which continue to work
-- unaffected by RLS (they run as the function owner, which bypasses
-- RLS regardless of policy state).
--
-- FIX
-- Enable RLS with NO policies (correct, intentional default-deny --
-- not "an unnecessarily broad policy just to make RLS appear
-- enabled", per instruction). Additionally revoke the excessive
-- direct table grants from anon/authenticated entirely, since RLS
-- alone is not sufficient defense-in-depth while a table-level grant
-- this broad remains in place (a future RLS policy change or a role
-- with BYPASSRLS would otherwise still be dangerously exposed).
-- ═══════════════════════════════════════════════════════════════

alter table rate_limit_hits enable row level security;

revoke all on table rate_limit_hits from anon, authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'rate_limit_hits',
  'migration_064 (PASS 9 Part 3): rate_limit_hits had RLS disabled and full (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) direct grants to anon and authenticated -- fully world-readable/writable via PostgREST. Confirmed via repository-wide search that the only legitimate access is through check_rate_limit()/prune_rate_limit_hits(), both SECURITY DEFINER and therefore unaffected by RLS. Enabled RLS with no policies (correct default-deny; no client has a legitimate reason for direct access) and revoked all direct table privileges from anon/authenticated.'
);
