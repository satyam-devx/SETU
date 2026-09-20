-- ═══════════════════════════════════════════════════════════════
-- Migration 082: Multi-category support for vendors and products
--
-- PROBLEM
-- vendors.category and products.category/category_id are single-value
-- columns — a vendor or product can only ever belong to exactly one
-- category. The request is for vendors/products to carry several
-- categories at once (e.g. a shop that sells both "Groceries &
-- Essentials" and "Snacks & Drinks").
--
-- Along the way, two pre-existing inconsistencies surfaced that this
-- migration also puts on a single, correct footing:
--   1. products.category_id (the real FK used by the category_previews
--      view — migration 073 — to compute sample images/counts) was
--      never actually being set by the product-create/edit flow, which
--      only ever wrote the free-text products.category column. So
--      category_previews' counts have been silently wrong for any
--      vendor-created product all along.
--   2. Vendor onboarding's category dropdown was a hardcoded local
--      list of category NAMES (10 strings baked into
--      VendorOnboarding.jsx) that did not read from — or necessarily
--      match — the real, admin-managed `categories` table at all. A
--      vendor could "select" a category whose name doesn't correspond
--      to any real category row.
--
-- DESIGN
-- Two new many-to-many junction tables are the source of truth for
-- category membership going forward:
--   - vendor_categories  (vendor_id, category_id)
--   - product_categories (product_id, category_id)
--
-- The existing single-value columns (vendors.category,
-- products.category, products.category_id) are NOT dropped — plenty
-- of existing code (badges, filters, the category_previews view, the
-- admin panel) reads them, and rewriting every one of those call
-- sites is a much larger, riskier change than this feature calls for.
-- Instead they become a kept-in-sync "primary category" cache: every
-- write to the junction tables goes through the two RPCs below, which
-- atomically keep vendors.category / products.category /
-- products.category_id pointed at the first category in the array the
-- caller passes. Existing single-category displays/filters keep
-- working unchanged; anything that needs the FULL set reads the new
-- junction tables (or the RPCs' return value) directly.
--
-- Direct table writes are intentionally NOT opened up to authenticated
-- users (same "RPC-only" pattern already used for `coupons` —
-- qa/sql/coupons_test.sql T7): only the two security-definer RPCs
-- below can write, so the legacy-column sync can never be skipped by
-- a write that goes around them.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- VENDOR_CATEGORIES
-- ─────────────────────────────────────────────────────────
create table if not exists vendor_categories (
  vendor_id   uuid    not null references vendors(id)    on delete cascade,
  category_id text    not null references categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (vendor_id, category_id)
);
create index if not exists idx_vendor_categories_vendor_id   on vendor_categories(vendor_id);
create index if not exists idx_vendor_categories_category_id on vendor_categories(category_id);

alter table vendor_categories enable row level security;

create policy "vendor_categories_public_read"
  on vendor_categories for select using (true);

create policy "vendor_categories_admin_all"
  on vendor_categories for all
  using  (is_admin())
  with check (is_admin());

-- ─────────────────────────────────────────────────────────
-- PRODUCT_CATEGORIES
-- ─────────────────────────────────────────────────────────
create table if not exists product_categories (
  product_id  uuid    not null references products(id)    on delete cascade,
  category_id text    not null references categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (product_id, category_id)
);
create index if not exists idx_product_categories_product_id  on product_categories(product_id);
create index if not exists idx_product_categories_category_id on product_categories(category_id);

alter table product_categories enable row level security;

create policy "product_categories_public_read"
  on product_categories for select using (true);

create policy "product_categories_admin_all"
  on product_categories for all
  using  (is_admin())
  with check (is_admin());

-- ─────────────────────────────────────────────────────────
-- BACKFILL — every existing vendor/product gets its current
-- single category represented as a one-row junction entry, so
-- nothing that already had a category appears "uncategorised"
-- the moment this ships.
-- ─────────────────────────────────────────────────────────

-- Vendors: match vendors.category (free text) to categories.name.
-- Vendors whose stored text doesn't match any real category name
-- (case-insensitive) are left with no junction row — same as they
-- have no valid category today — rather than guessing.
insert into vendor_categories (vendor_id, category_id)
select v.id, c.id
from vendors v
join categories c on lower(trim(c.name)) = lower(trim(v.category))
on conflict do nothing;

-- Products: prefer the real FK (category_id) when it's already set;
-- fall back to matching the free-text category column by name for
-- everything else (which, per the note above, is effectively every
-- vendor-created product up to now).
insert into product_categories (product_id, category_id)
select p.id, p.category_id
from products p
where p.category_id is not null
on conflict do nothing;

insert into product_categories (product_id, category_id)
select p.id, c.id
from products p
join categories c on lower(trim(c.name)) = lower(trim(p.category))
where p.category is not null
  and not exists (
    select 1 from product_categories pc where pc.product_id = p.id
  )
on conflict do nothing;

-- ─────────────────────────────────────────────────────────
-- set_vendor_categories(vendor_id, category_ids[])
-- Atomically replaces a vendor's full category set and keeps
-- vendors.category (not-null) pointed at the first id in the array.
-- ─────────────────────────────────────────────────────────
create or replace function set_vendor_categories(p_vendor_id uuid, p_category_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_owner     uuid;
  v_valid_ids text[];
  v_first_name text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select owner_id into v_owner from vendors where id = p_vendor_id;
  if v_owner is null then
    return jsonb_build_object('success', false, 'error', 'Vendor not found');
  end if;
  if v_owner <> v_uid and not is_admin() then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if p_category_ids is null or array_length(p_category_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'Select at least one category');
  end if;

  -- Only ids that actually exist as active categories — silently
  -- drops anything bogus rather than letting an FK violation abort
  -- the whole call, but still requires at least one to remain.
  select array_agg(distinct u.id) into v_valid_ids
  from unnest(p_category_ids) as u(id)
  join categories c on c.id = u.id and c.is_active = true;

  if v_valid_ids is null or array_length(v_valid_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'None of the selected categories are valid');
  end if;

  delete from vendor_categories where vendor_id = p_vendor_id;
  insert into vendor_categories (vendor_id, category_id)
  select p_vendor_id, cid from unnest(v_valid_ids) as cid;

  select name into v_first_name from categories where id = v_valid_ids[1];
  update vendors set category = v_first_name, updated_at = now() where id = p_vendor_id;

  return jsonb_build_object('success', true, 'category_ids', v_valid_ids);
end;
$$;

grant execute on function set_vendor_categories(uuid, text[]) to authenticated;

-- ─────────────────────────────────────────────────────────
-- set_product_categories(product_id, category_ids[])
-- Same shape as set_vendor_categories, for a product owned by the
-- caller's own vendor row. Also keeps products.category_id (the real
-- FK the category_previews view reads) in sync, not just the free-text
-- products.category column — closing gap #1 described above.
-- ─────────────────────────────────────────────────────────
create or replace function set_product_categories(p_product_id uuid, p_category_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_vendor_owner uuid;
  v_valid_ids text[];
  v_first_name text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select v.owner_id into v_vendor_owner
  from products p join vendors v on v.id = p.vendor_id
  where p.id = p_product_id;

  if v_vendor_owner is null then
    return jsonb_build_object('success', false, 'error', 'Product not found');
  end if;
  if v_vendor_owner <> v_uid and not is_admin() then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if p_category_ids is null or array_length(p_category_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'Select at least one category');
  end if;

  select array_agg(distinct u.id) into v_valid_ids
  from unnest(p_category_ids) as u(id)
  join categories c on c.id = u.id and c.is_active = true;

  if v_valid_ids is null or array_length(v_valid_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'None of the selected categories are valid');
  end if;

  delete from product_categories where product_id = p_product_id;
  insert into product_categories (product_id, category_id)
  select p_product_id, cid from unnest(v_valid_ids) as cid;

  select name into v_first_name from categories where id = v_valid_ids[1];
  update products
     set category = v_first_name, category_id = v_valid_ids[1], updated_at = now()
   where id = p_product_id;

  return jsonb_build_object('success', true, 'category_ids', v_valid_ids);
end;
$$;

grant execute on function set_product_categories(uuid, text[]) to authenticated;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'vendor_categories,product_categories', 'table',
  'migration_082: added vendor_categories/product_categories many-to-many junction tables (RPC-only write via set_vendor_categories/set_product_categories, public read), backfilled from existing vendors.category/products.category/products.category_id, and fixed products.category_id never being set by the product create/edit flow (which the category_previews view, migration 073, depends on).'
);
