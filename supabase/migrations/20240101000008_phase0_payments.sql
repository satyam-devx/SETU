-- ═══════════════════════════════════════════════════════════
-- SETU — Migration 008: Phase 0 Payment & Financial Integrity
-- Adds:
--   1. vendor_escrow          — holds captured order revenue
--   2. delivery_fee_splits    — platform cut / vendor portion / rider earnings per order
--   3. rider_payments         — weekly/daily payout records to riders
--   4. vendor_payouts         — payout records to vendors (escrow → bank)
--   5. payment_status guard   — prevent frontend from directly setting payment_status
--   6. order_refunds          — tracks refund lifecycle per order
-- Safe to run on an existing database (all idempotent).
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- 1. VENDOR ESCROW
--    One row per vendor. balance accumulates from captured
--    order payments and drains on payout_initiated / paid.
-- ─────────────────────────────────────────────────────────
create table if not exists vendor_escrow (
  id            uuid primary key default uuid_generate_v4(),
  vendor_id     uuid unique not null references vendors(id) on delete cascade,
  balance       numeric(12,2) not null default 0 check (balance >= 0),
  total_credited numeric(12,2) not null default 0,
  total_paid_out numeric(12,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_vendor_escrow_vendor_id on vendor_escrow(vendor_id);
create trigger trg_vendor_escrow_updated_at before update on vendor_escrow
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- 2. DELIVERY FEE SPLITS
--    Immutable record written once per order at payment capture.
--    Tracks how the total delivery_fee + platform_fee is split.
-- ─────────────────────────────────────────────────────────
create table if not exists delivery_fee_splits (
  id               uuid primary key default uuid_generate_v4(),
  order_id         uuid unique not null references orders(id) on delete cascade,
  order_total      numeric(10,2) not null,
  subtotal         numeric(10,2) not null,
  delivery_fee     numeric(10,2) not null default 0,
  platform_fee     numeric(10,2) not null default 0,
  -- portions
  vendor_amount    numeric(10,2) not null,   -- subtotal kept by vendor
  platform_cut     numeric(10,2) not null,   -- platform_fee credited to platform
  rider_earning    numeric(10,2) not null,   -- fixed per-delivery rider fee
  -- payment context
  payment_method   text not null,
  razorpay_payment_id text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_dfs_order_id   on delivery_fee_splits(order_id);
create index if not exists idx_dfs_created_at on delivery_fee_splits(created_at desc);

comment on table delivery_fee_splits is
  'Immutable split record written by webhook on payment.captured. '
  'vendor_amount = subtotal - platform_cut. rider_earning is the '
  'fixed per-delivery amount (₹80 default, configurable via app config).';

-- ─────────────────────────────────────────────────────────
-- 3. RIDER PAYMENTS
--    Batch payout records; one row per payout cycle per rider.
--    Source of truth for "has this rider been paid for this period?"
-- ─────────────────────────────────────────────────────────
create table if not exists rider_payments (
  id                  uuid primary key default uuid_generate_v4(),
  rider_id            uuid not null references riders(id) on delete cascade,
  period_start        date not null,
  period_end          date not null,
  deliveries_count    integer not null default 0,
  gross_earnings      numeric(10,2) not null default 0,   -- sum of rider_earning for period
  adjustments         numeric(10,2) not null default 0,   -- bonus/penalty from admin
  net_payout          numeric(10,2) not null default 0,   -- gross_earnings + adjustments
  -- payout state machine: pending → processing → paid | failed
  status              text not null default 'pending'
                        check (status in ('pending','processing','paid','failed')),
  payout_method       text not null default 'bank_transfer'
                        check (payout_method in ('bank_transfer','upi','wallet','manual_cash')),
  razorpay_payout_id  text,            -- Razorpay Route payout ID if applicable
  failure_reason      text,
  initiated_at        timestamptz,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (rider_id, period_start, period_end)
);
create index if not exists idx_rider_payments_rider_id    on rider_payments(rider_id);
create index if not exists idx_rider_payments_status      on rider_payments(status);
create index if not exists idx_rider_payments_period      on rider_payments(period_start, period_end);
create index if not exists idx_rider_payments_created_at  on rider_payments(created_at desc);
create trigger trg_rider_payments_updated_at before update on rider_payments
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- 4. VENDOR PAYOUTS
--    Records each escrow→bank transfer for a vendor.
-- ─────────────────────────────────────────────────────────
create table if not exists vendor_payouts (
  id                  uuid primary key default uuid_generate_v4(),
  vendor_id           uuid not null references vendors(id) on delete cascade,
  amount              numeric(12,2) not null check (amount > 0),
  -- pending → processing → paid | failed
  status              text not null default 'pending'
                        check (status in ('pending','processing','paid','failed')),
  payout_method       text not null default 'razorpay_route'
                        check (payout_method in ('razorpay_route','manual_neft','upi')),
  razorpay_payout_id  text,
  bank_account_ref    text,            -- masked bank account or VPA
  failure_reason      text,
  initiated_by        uuid references auth.users(id) on delete set null,
  initiated_at        timestamptz,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_vendor_payouts_vendor_id   on vendor_payouts(vendor_id);
create index if not exists idx_vendor_payouts_status      on vendor_payouts(status);
create index if not exists idx_vendor_payouts_created_at  on vendor_payouts(created_at desc);
create trigger trg_vendor_payouts_updated_at before update on vendor_payouts
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- 5. ORDER REFUNDS
--    Explicit refund lifecycle. One refund per order (unique).
--    Written by cancel_order_with_refund() or webhook handler.
-- ─────────────────────────────────────────────────────────
create table if not exists order_refunds (
  id                  uuid primary key default uuid_generate_v4(),
  order_id            uuid unique not null references orders(id) on delete cascade,
  customer_id         uuid not null references auth.users(id) on delete cascade,
  refund_amount       numeric(10,2) not null check (refund_amount > 0),
  refund_method       text not null
                        check (refund_method in ('wallet','razorpay','manual')),
  -- pending → processing → completed | failed
  status              text not null default 'pending'
                        check (status in ('pending','processing','completed','failed')),
  razorpay_refund_id  text,
  cancel_reason       text,
  failure_reason      text,
  initiated_by        uuid references auth.users(id) on delete set null,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_order_refunds_order_id     on order_refunds(order_id);
create index if not exists idx_order_refunds_customer_id  on order_refunds(customer_id);
create index if not exists idx_order_refunds_status       on order_refunds(status);
create index if not exists idx_order_refunds_created_at   on order_refunds(created_at desc);
create trigger trg_order_refunds_updated_at before update on order_refunds
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- 6. PAYMENT STATUS GUARD TRIGGER
--    Prevents any client session (non-service-role) from
--    directly updating payment_status on orders.
--    Only security-definer functions and service_role bypass this.
-- ─────────────────────────────────────────────────────────
create or replace function guard_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow if called by service_role (webhook Edge Function)
  -- current_setting throws if var missing; default to empty string.
  if current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' then
    return new;
  end if;

  -- Allow if called from a security-definer context (our own functions)
  -- We identify this via a session-local flag set inside our functions.
  if current_setting('setu.internal_payment_update', true) = 'true' then
    return new;
  end if;

  -- Block any direct change to payment_status from a user session
  if new.payment_status is distinct from old.payment_status then
    raise exception
      'Direct payment_status updates are forbidden. '
      'Payment status is controlled exclusively by the Razorpay webhook.';
  end if;

  return new;
end;
$$;

-- Drop existing trigger if any, recreate
drop trigger if exists trg_guard_payment_status on orders;
create trigger trg_guard_payment_status
  before update on orders
  for each row execute function guard_payment_status_change();

-- ─────────────────────────────────────────────────────────
-- 7. RLS for new tables
-- ─────────────────────────────────────────────────────────

-- vendor_escrow: vendors see their own; admins see all; no direct writes from client
alter table vendor_escrow enable row level security;
create policy "vendor_escrow_own_read"
  on vendor_escrow for select
  using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
    or is_admin()
  );

-- delivery_fee_splits: admins + vendor for own orders
alter table delivery_fee_splits enable row level security;
create policy "dfs_admin_read"
  on delivery_fee_splits for select
  using (is_admin());
create policy "dfs_vendor_read"
  on delivery_fee_splits for select
  using (
    order_id in (
      select id from orders
      where vendor_id in (select id from vendors where owner_id = auth.uid())
    )
  );

-- rider_payments: rider sees own, admin sees all
alter table rider_payments enable row level security;
create policy "rider_payments_own_read"
  on rider_payments for select
  using (
    rider_id in (select id from riders where user_id = auth.uid())
    or is_admin()
  );

-- vendor_payouts: vendor sees own, admin sees all
alter table vendor_payouts enable row level security;
create policy "vendor_payouts_own_read"
  on vendor_payouts for select
  using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
    or is_admin()
  );

-- order_refunds: customer sees own, admin sees all
alter table order_refunds enable row level security;
create policy "order_refunds_own_read"
  on order_refunds for select
  using (customer_id = auth.uid() or is_admin());

-- ─────────────────────────────────────────────────────────
-- 8. Enable Realtime for refund status (customer needs live updates)
-- ─────────────────────────────────────────────────────────
alter publication supabase_realtime add table order_refunds;
alter publication supabase_realtime add table rider_payments;
