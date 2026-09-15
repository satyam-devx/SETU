-- ═══════════════════════════════════════════════════════════════
-- Migration 069: Allow products to exist with no vendor assigned
--
-- Admin/Super Admin need to be able to create a catalog entry
-- (name, price, category) before a vendor has been decided/onboarded,
-- and to remove a vendor from an existing product. Previously
-- `products.vendor_id` was `not null`, so any insert/update with no
-- vendor selected failed with:
--   null value in column "vendor_id" of relation "products"
--   violates not-null constraint
--
-- This only changes what's allowed to be NULL — it does not touch
-- RLS (products_admin_all already covers admin/super_admin via
-- is_admin(), unaffected by nullability) or the vendor's own
-- self-service policies (products_own_*, which are scoped by
-- `vendor_id in (select id from vendors where owner_id = auth.uid())`
-- and simply never match a NULL vendor_id — a vendor can still only
-- ever see/edit their own products, never unassigned ones).
--
-- admin_products_view (migration 010) already LEFT JOINs vendors, so
-- vendor-less products already surface correctly in the admin product
-- list once this constraint is gone — no view change needed.
-- ═══════════════════════════════════════════════════════════════

-- 1. Drop the NOT NULL constraint.
alter table products
  alter column vendor_id drop not null;

-- 2. Replace ON DELETE CASCADE with ON DELETE SET NULL.
--    Previously, deleting a vendor deleted every one of their products
--    outright. Now that a product can legitimately have no vendor,
--    the more correct behavior if a vendor account is removed is to
--    unassign their products (falling back to the same "no vendor"
--    state an admin can already choose deliberately) rather than
--    silently destroying catalog data.
alter table products
  drop constraint if exists products_vendor_id_fkey;

alter table products
  add constraint products_vendor_id_fkey
  foreign key (vendor_id) references vendors(id) on delete set null;

-- 3. is_available should never be settable to true for a product
--    with no vendor and nothing to fulfill it from — this mirrors
--    what the application layer enforces (a vendor-less product is a
--    draft catalog entry, not something customers can order yet) as
--    a real database-level guarantee rather than a client-side-only
--    rule that a direct API/SQL call could bypass.
alter table products
  add constraint products_available_requires_vendor
  check (not is_available or vendor_id is not null);

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'products', 'table',
  'migration_069: vendor_id is now nullable (ON DELETE SET NULL instead of CASCADE); added a check constraint so a vendor-less product can never be marked available for ordering'
);
