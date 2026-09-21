-- ═══════════════════════════════════════════════════════════════
-- Migration 085: riders.license_number
--
-- RiderOnboarding.jsx's Step 1 has always collected a driving licence
-- number from the rider, but riders has never had anywhere to put it
-- — the value was held in component state and then silently dropped
-- at submit time (the Step 5 insert into `riders` never referenced
-- it). Adding the column so it's actually persisted.
-- ═══════════════════════════════════════════════════════════════

alter table riders add column if not exists license_number text;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'riders', 'table',
  'migration_085: added riders.license_number — RiderOnboarding.jsx collected a driving licence number from Step 1 onward but had no column to save it to, so it was silently discarded at submit.'
);
