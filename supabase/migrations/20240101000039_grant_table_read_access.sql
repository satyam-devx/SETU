-- ═══════════════════════════════════════════════════════════════
-- Migration 039: explicit SELECT grants for anon/authenticated
--
-- ROOT CAUSE:
--   No migration ever granted table privileges to the anon/authenticated
--   roles — the app relied entirely on Supabase's project-level default
--   privileges. The production database has those grants (and the reset
--   restored them), but a bare `supabase start` in CI does not reliably
--   apply them, so any direct table SELECT as `authenticated` fails with
--   "permission denied for table ..." BEFORE RLS is even evaluated
--   (e.g. security_ops/finance_depth reading orders, vendor_escrow).
--
-- FIX:
--   Grant SELECT on all public tables to anon + authenticated and make
--   it the default for future tables. Row visibility is still fully
--   governed by RLS (every sensitive table has RLS enabled). SELECT only
--   — writes continue to flow through the SECURITY DEFINER RPCs, and the
--   "direct write denied" proofs keep returning 42501.
--
--   EXECUTE grants are deliberately NOT touched here so the lockdown in
--   migration 035 stays in force.
-- ═══════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;

grant select on all tables in schema public to anon, authenticated;

alter default privileges in schema public
  grant select on tables to anon, authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'grants',
  'migration_039: explicit SELECT grant on public tables to anon/authenticated (RLS still governs rows); makes the schema self-contained instead of relying on project default privileges.'
);
