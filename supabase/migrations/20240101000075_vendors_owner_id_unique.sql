-- ═══════════════════════════════════════════════════════════════
-- vendors.owner_id unique constraint
--
-- upsertVendorProfile() (src/lib/api.js) has always called
--   supabase.from('vendors').upsert(data, { onConflict: 'owner_id' })
-- but `owner_id` on `vendors` only ever had a plain, non-unique index
-- (idx_vendors_owner_id from the initial schema) — Postgres requires
-- an actual unique or exclusion constraint matching the ON CONFLICT
-- target, so every one of these upserts has always failed with:
--   "there is no unique or exclusion constraint matching the ON
--    CONFLICT specification"
-- This is the exact same failure class already fixed once for
-- kyc_records in 20240101000014_security_fixes_round2.sql — same
-- fix here, with the same safe skip-if-duplicates guard (one owner
-- should only ever have one vendor row, so this should apply
-- cleanly, but a prior buggy write path could in theory have left
-- duplicates).
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendors_owner_id_key'
  ) then
    alter table vendors add constraint vendors_owner_id_key unique (owner_id);
  end if;
exception when others then
  raise notice 'Skipping vendors_owner_id_key — existing duplicate owner_id rows must be de-duplicated manually first: %', sqlerrm;
end $$;
