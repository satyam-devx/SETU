-- ═══════════════════════════════════════════════════════════════
-- Migration 052: Add order_number text to support_tickets
--
-- The support_tickets table had order_id (uuid FK to orders) but
-- customers type their order number as text (e.g. SETU-2025-0001).
-- Adding order_number text lets the Help & Support screen store
-- the human-readable order reference without requiring a UUID lookup
-- at ticket-creation time (the user may not know their order UUID).
-- ═══════════════════════════════════════════════════════════════

alter table support_tickets
  add column if not exists order_number text;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'support_tickets', 'table',
  'migration_052: added order_number text column so customers can reference orders by human-readable number in support tickets'
);
