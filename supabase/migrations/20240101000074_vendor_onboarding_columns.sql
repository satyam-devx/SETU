-- ═══════════════════════════════════════════════════════════════
-- Vendor onboarding columns
--
-- VendorOnboarding.jsx (src/pages/vendor/VendorOnboarding.jsx) has
-- been upserting onboarding_status, onboarding_step, shop_photos,
-- description, landmark and submitted_at onto `vendors` since it
-- was written — but none of those columns were ever added to the
-- schema (checked against every prior migration). Every Step 2
-- save therefore fails against the real database with a
-- "column ... does not exist" / "could not find column in schema
-- cache" error, which is surfaced to the vendor as a generic
-- "Failed to save shop details" — blocking onboarding for every
-- vendor past Step 2 in any environment with a real Supabase
-- schema. This is the same failure class already documented and
-- fixed once before for a different table in
-- 20240101000014_security_fixes_round2.sql.
-- ═══════════════════════════════════════════════════════════════

alter table vendors
  add column if not exists description      text,
  add column if not exists landmark         text,
  add column if not exists shop_photos      text[] not null default '{}',
  add column if not exists onboarding_step  integer not null default 1,
  add column if not exists onboarding_status text not null default 'draft'
    check (onboarding_status in ('draft', 'submitted', 'approved', 'rejected')),
  add column if not exists submitted_at     timestamptz;

create index if not exists idx_vendors_onboarding_status on vendors(onboarding_status);
