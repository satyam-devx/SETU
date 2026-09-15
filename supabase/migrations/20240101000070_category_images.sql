-- ═══════════════════════════════════════════════════════════════
-- Migration 070: Category images
--
-- Categories previously only had `icon` (a single emoji character).
-- Request: replace emoji dependency with real, admin-uploaded images.
--
-- `icon` is kept (not dropped) as a lightweight fallback — existing
-- categories already have one, it costs nothing to keep, and the
-- customer UI uses it as a small monogram-style placeholder while an
-- image is loading or if a category has no image yet, rather than a
-- blank tile. New/edited categories are expected to set image_url.
--
-- Follows the exact same bucket + RLS pattern migration 045 already
-- established for product-images/vendor-images, except write access
-- is admin-only (is_admin()) rather than owner-scoped, since only
-- Admin/Super Admin manage the category list.
-- ═══════════════════════════════════════════════════════════════

alter table categories
  add column if not exists image_url text;

-- ── category-images bucket ───────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('category-images', 'category-images', true)
on conflict (id) do nothing;

drop policy if exists "category_images_read"   on storage.objects;
drop policy if exists "category_images_insert" on storage.objects;
drop policy if exists "category_images_update" on storage.objects;
drop policy if exists "category_images_delete" on storage.objects;

create policy "category_images_read" on storage.objects for select
  using (bucket_id = 'category-images');

-- Insert/update/delete: admin or super_admin only (is_admin()) — this
-- bucket has no per-owner concept the way product-images does, since
-- categories are platform-wide, not vendor-owned.
create policy "category_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'category-images' and is_admin());
create policy "category_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'category-images' and is_admin());
create policy "category_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'category-images' and is_admin());

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'categories', 'table',
  'migration_070: added categories.image_url + category-images storage bucket (admin-only write, public read), replacing emoji-only category icons'
);
