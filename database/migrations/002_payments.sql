-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — PAYMENTS & FINANCIAL LAYER
-- Phase 3: Razorpay, COD, Wallet, and Credit
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- PAYMENT ORDERS (Razorpay Link)
-- ─────────────────────────────────────────────────────────
create table if not exists payment_orders (
  id                uuid primary key default gen_random_uuid(),
  razorpay_order_id text unique not null,
  order_id          uuid references orders(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  amount            numeric(12,2) not null,
  currency          text not null default 'INR',
  status            text not null default 'created'
                      check (status in ('created','attempted','paid','failed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_payment_orders_order_id on payment_orders(order_id);
create index if not exists idx_payment_orders_rzp_id   on payment_orders(razorpay_order_id);

-- ─────────────────────────────────────────────────────────
-- PAYMENT EVENTS (Webhook Audit Trail)
-- ─────────────────────────────────────────────────────────
create table if not exists payment_events (
  id               uuid primary key default gen_random_uuid(),
  event_type       text not null,
  razorpay_order_id text,
  payload          jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists idx_payment_events_rzp_id on payment_events(razorpay_order_id);

-- ─────────────────────────────────────────────────────────
-- WALLET TOPUPS
-- ─────────────────────────────────────────────────────────
create table if not exists wallet_topups (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  amount            numeric(12,2) not null,
  payment_id        text, -- razorpay_payment_id
  status            text not null default 'pending'
                      check (status in ('pending','completed','failed')),
  created_at        timestamptz not null default now()
);
create index if not exists idx_wallet_topups_user_id on wallet_topups(user_id);

-- ─────────────────────────────────────────────────────────
-- CREDIT DISBURSEMENTS
-- ─────────────────────────────────────────────────────────
create table if not exists credit_disbursements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  amount            numeric(12,2) not null,
  purpose           text,
  repayment_due     timestamptz not null,
  status            text not null default 'active'
                      check (status in ('active','repaid','overdue','defaulted')),
  created_at        timestamptz not null default now()
);
create index if not exists idx_credit_disbursements_user_id on credit_disbursements(user_id);

-- ─────────────────────────────────────────────────────────
-- RLS POLICIES
-- ─────────────────────────────────────────────────────────
alter table payment_orders enable row level security;
alter table payment_events enable row level security;
alter table wallet_topups  enable row level security;
alter table credit_disbursements enable row level security;

-- Payment Orders
create policy "payment_orders_own" on payment_orders
  for select using (user_id = auth.uid());

-- Payment Events (Admins only)
create policy "payment_events_admin" on payment_events
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','super_admin'))
  );

-- Wallet Topups
create policy "wallet_topups_own" on wallet_topups
  for select using (user_id = auth.uid());

-- Credit Disbursements
create policy "credit_disbursements_own" on credit_disbursements
  for select using (user_id = auth.uid());
