-- ═══════════════════════════════════════════════════════════════
-- Migration 073: Category preview cards (sample product images + count)
--
-- The Home category tiles are being redesigned to show a 2x2 collage
-- of real product photos from that category plus an accurate "+N
-- more" count, instead of a single category image/icon. That needs
-- real data — up to 4 sample product image URLs and the true
-- available-product count per category — which isn't something the
-- existing `categories` or `products` table can answer in one round
-- trip without this view.
--
-- Public/read-only data only (the same active categories and
-- available products anon/customers can already see via
-- categories_public_read / a plain products query) — no RLS bypass
-- risk the way the admin-only views were, so this is a plain view
-- with a normal grant, not a security-definer function.
-- ═══════════════════════════════════════════════════════════════

create or replace view category_previews as
select
  c.id,
  c.name,
  c.name_hindi,
  c.icon,
  c.image_url,
  c.sort_order,
  coalesce(
    (
      select array_agg(sub.image_url)
      from (
        select p.image_url
        from products p
        where p.category_id = c.id
          and p.is_available = true
          and p.image_url is not null
        order by p.updated_at desc
        limit 4
      ) sub
    ),
    array[]::text[]
  ) as sample_images,
  (
    select count(*)
    from products p2
    where p2.category_id = c.id
      and p2.is_available = true
  ) as product_count
from categories c
where c.is_active = true
order by c.sort_order;

grant select on category_previews to anon, authenticated;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'categories', 'view',
  'migration_073: added category_previews view (sample_images: up to 4 recent available-product photos per category, product_count: true available count) backing the redesigned Home category cards'
);
