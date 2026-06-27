-- ═══════════════════════════════════════════════════════════════
-- Migration 045: storage buckets + RLS policies (version-controlled)
--
-- The app uploads to three Supabase Storage buckets:
--   • product-images  — public catalog images (VendorAddProduct)
--   • vendor-images   — public shop images (VendorOnboarding)
--   • kyc-documents   — SENSITIVE identity docs (kyc.js: kyc/<uid>/...)
--
-- None of these had bucket/policy definitions in the migration tree —
-- security lived only in the Supabase dashboard (not version-controlled,
-- not reproducible, and a real risk: if kyc-documents were public, Aadhaar
-- documents would be world-readable). This migration makes storage
-- security explicit and correct.
--
-- Model:
--   product-images / vendor-images : public read; authenticated upload;
--                                    owner may update/delete own objects.
--   kyc-documents (PRIVATE)        : only the owner or an admin may read;
--                                    authenticated upload; no public read;
--                                    only admins may delete (audit trail).
-- ═══════════════════════════════════════════════════════════════

-- ── Buckets (public flag governs CDN read for the image buckets) ──
insert into storage.buckets (id, name, public) values
  ('product-images', 'product-images', true),
  ('vendor-images',  'vendor-images',  true),
  ('kyc-documents',  'kyc-documents',  false)
on conflict (id) do nothing;

-- ── product-images ───────────────────────────────────────────────
drop policy if exists "product_images_read"   on storage.objects;
drop policy if exists "product_images_insert" on storage.objects;
drop policy if exists "product_images_update" on storage.objects;
drop policy if exists "product_images_delete" on storage.objects;

create policy "product_images_read"   on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
create policy "product_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and owner = auth.uid());
create policy "product_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and owner = auth.uid());

-- ── vendor-images ────────────────────────────────────────────────
drop policy if exists "vendor_images_read"   on storage.objects;
drop policy if exists "vendor_images_insert" on storage.objects;
drop policy if exists "vendor_images_update" on storage.objects;
drop policy if exists "vendor_images_delete" on storage.objects;

create policy "vendor_images_read"   on storage.objects for select
  using (bucket_id = 'vendor-images');
create policy "vendor_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'vendor-images');
create policy "vendor_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'vendor-images' and owner = auth.uid());
create policy "vendor_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'vendor-images' and owner = auth.uid());

-- ── kyc-documents (PRIVATE — PII) ────────────────────────────────
drop policy if exists "kyc_docs_read"   on storage.objects;
drop policy if exists "kyc_docs_insert" on storage.objects;
drop policy if exists "kyc_docs_delete" on storage.objects;

-- Read: the uploader (owner) or an admin only. No public/anon read.
create policy "kyc_docs_read" on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and (owner = auth.uid() or is_admin()));
-- Upload: any authenticated user (owner is set to their uid automatically).
create policy "kyc_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and owner = auth.uid());
-- Delete: admins only (KYC docs are evidence; users can't remove them).
create policy "kyc_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'kyc-documents' and is_admin());
