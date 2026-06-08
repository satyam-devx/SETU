-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — PAYMENT INFRASTRUCTURE
-- Migration: 002_payments.sql
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- PAYMENT ORDERS (Internal tracking for Razorpay orders)
-- ─────────────────────────────────────────────────────────
create table if not exists payment_orders (
  id                  uuid primary key default uuid_generate_v4(),
  razorpay_order_id   text unique not null,
  order_id            uuid references orders(id) on delete cascade,
  user_id             uuid references auth.users(id) on delete cascade,
  amount              numeric(10,2) not null,
  currency            text not null default 'INR',
  status              text not null default 'created', -- created, attempted, paid, failed
  notes               jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table payment_orders enable row level security;
create policy "Users can read own payment orders" on payment_orders for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- PAYMENT EVENTS (Webhook Log / Idempotency)
-- ─────────────────────────────────────────────────────────
create table if not exists payment_events (
  id                  uuid primary key default uuid_generate_v4(),
  event_id            text unique not null, -- Razorpay event ID
  type                text not null,        -- payment.captured, order.paid, etc.
  payload             jsonb not null,
  processed_at        timestamptz,
  created_at          timestamptz not null default now()
);

alter table payment_events enable row level security;
-- Only system/service role should interact here, but for visibility:
create policy "Admins can read payment events" on payment_events for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','super_admin'))
);

-- ─────────────────────────────────────────────────────────
-- WALLET TOPUPS (Verified via webhook)
-- ─────────────────────────────────────────────────────────
create table if not exists wallet_topups (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  amount              numeric(10,2) not null,
  payment_id          text, -- Razorpay payment ID
  razorpay_order_id   text unique,
  status              text not null default 'pending', -- pending, completed, failed
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table wallet_topups enable row level security;
create policy "Users can read own topups" on wallet_topups for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- CREDIT DISBURSEMENTS (Application tracking)
-- ─────────────────────────────────────────────────────────
create table if not exists credit_disbursements (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  amount              numeric(10,2) not null,
  purpose             text,
  status              text not null default 'pending', -- pending, approved, rejected, disbursed
  repayment_due_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table credit_disbursements enable row level security;
create policy "Users can read own disbursements" on credit_disbursements for select using (auth.uid() = user_id);
