-- ═══════════════════════════════════════════════════════════════
-- vendor_payment_info table
--
-- VendorOnboarding.jsx Step 4 has always upserted bank/UPI details
-- into `vendor_payment_info`, but this table was never actually
-- created anywhere in the migration history (confirmed by
-- exhaustively grepping every migration for its name) — the app
-- code and the SQL migrations for this table were simply never
-- written together. Every Step 4 save has therefore always failed
-- with PostgREST's "Could not find the table 'public.vendor_
-- payment_info' in the schema cache".
--
-- (Not the same table as vendor_escrow, added in migration 008 —
-- that one tracks the platform's running balance owed to a vendor;
-- this one holds the vendor's own bank/UPI details for payouts.)
-- ═══════════════════════════════════════════════════════════════

create table if not exists vendor_payment_info (
  id             uuid primary key default uuid_generate_v4(),
  vendor_id      uuid unique not null references vendors(id) on delete cascade,
  account_name   text,
  account_number text,
  ifsc           text,
  bank_name      text,
  upi_id         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_vendor_payment_info_vendor_id on vendor_payment_info(vendor_id);
create trigger trg_vendor_payment_info_updated_at before update on vendor_payment_info
  for each row execute function update_updated_at();

-- RLS: this holds bank details — a vendor may read/write only their
-- own row; admins (for payout processing) may read all; nobody else.
alter table vendor_payment_info enable row level security;

create policy "vendor_payment_info_own_select"
  on vendor_payment_info for select
  using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
    or is_admin()
  );

create policy "vendor_payment_info_own_insert"
  on vendor_payment_info for insert
  with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "vendor_payment_info_own_update"
  on vendor_payment_info for update
  using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  )
  with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );
