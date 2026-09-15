-- ═══════════════════════════════════════════════════════════════
-- Migration 071: Structured banner customization
--
-- Previously a banner was just: title, subtitle, a single optional
-- image_url (rendered as a small side thumbnail, not a real
-- background), a link, and one solid bg_color. This adds the fields
-- needed for a real "marketing banner builder" — gradients, a full
-- image background with readability overlay, a distinct foreground/
-- product image for split compositions, an explicit CTA button label,
-- an optional eyebrow/badge, and a layout choice — without going as
-- far as a freeform design canvas.
-- ═══════════════════════════════════════════════════════════════

alter table banners
  add column if not exists cta_text             text,
  add column if not exists badge_text            text,
  add column if not exists bg_type               text not null default 'solid',
  add column if not exists gradient_to            text,
  add column if not exists overlay_opacity        integer not null default 0,
  add column if not exists layout                 text not null default 'text-only',
  add column if not exists foreground_image_url    text;

alter table banners
  add constraint banners_bg_type_check
    check (bg_type in ('solid', 'gradient', 'image'));

alter table banners
  add constraint banners_layout_check
    check (layout in ('text-only', 'image-left', 'image-right', 'image-dominant'));

alter table banners
  add constraint banners_overlay_opacity_check
    check (overlay_opacity >= 0 and overlay_opacity <= 100);

-- Existing rows: infer bg_type from what they already have, so
-- current banners keep rendering exactly as before rather than
-- silently changing appearance under the new renderer.
update banners set bg_type = 'image' where image_url is not null and bg_type = 'solid';

-- ── banner-images bucket (background + foreground images) ────────
-- Same pattern as migration 070's category-images: admin-only write,
-- public read.
insert into storage.buckets (id, name, public) values
  ('banner-images', 'banner-images', true)
on conflict (id) do nothing;

drop policy if exists "banner_images_read"   on storage.objects;
drop policy if exists "banner_images_insert" on storage.objects;
drop policy if exists "banner_images_update" on storage.objects;
drop policy if exists "banner_images_delete" on storage.objects;

create policy "banner_images_read" on storage.objects for select
  using (bucket_id = 'banner-images');
create policy "banner_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'banner-images' and is_admin());
create policy "banner_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'banner-images' and is_admin());
create policy "banner_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'banner-images' and is_admin());

-- ── Realtime ───────────────────────────────────────────────────
-- The customer app previously didn't fetch from this table at all
-- (Home rendered a hardcoded static array — see api layer comments),
-- so there was nothing to subscribe to. Now that it does, add banners
-- to the realtime publication so INSERT/UPDATE/DELETE push to
-- subscribed customer sessions, matching how orders/notifications
-- already work.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'banners'
  ) then
    alter publication supabase_realtime add table banners;
  end if;
exception when others then
  -- Publication may not exist under this name in every environment
  -- (e.g. local/test) — don't fail the whole migration over it.
  null;
end $$;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'banners', 'table',
  'migration_071: added structured customization fields (cta_text, badge_text, bg_type, gradient_to, overlay_opacity, layout, foreground_image_url), a banner-images storage bucket, and enabled realtime on the banners table'
);
