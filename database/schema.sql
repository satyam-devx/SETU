-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — COMPLETE DATABASE SCHEMA
-- Phase 2 hardened: pgcrypto, order_number_seq, missing tables,
--                   payment_events canonical, Aadhaar encryption.
-- Run this entire file in Supabase SQL Editor as one migration.
-- ═══════════════════════════════════════════════════════════

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";     -- text search
create extension if not exists "pgcrypto";    -- Aadhaar encryption, gen_random_bytes
create extension if not exists "pg_cron";     -- scheduled jobs (rider_locations cleanup)

-- ── HELPER: auto-update updated_at ───────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────
-- VILLAGES
-- ─────────────────────────────────────────────────────────
create table if not exists villages (
  id           text primary key default gen_random_uuid()::text,
  name         text    not null,
  block        text    not null,
  district     text    not null default 'Madhubani',
  state        text    not null default 'Bihar',
  population   integer not null default 0,
  lat          numeric(10,6),
  lng          numeric(10,6),
  is_active    boolean not null default true,
  anchor_id    uuid    references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_villages_block     on villages(block);
create index if not exists idx_villages_is_active on villages(is_active);
create trigger trg_villages_updated_at before update on villages
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- phone is nullable — OAuth users have no phone at sign-up;
-- handle_new_user trigger (functions.sql) may leave it null.
-- ─────────────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  phone        text unique,          -- nullable: OAuth users, auto-created profiles
  name         text,
  role         text not null default 'customer'
                 check (role in ('customer','vendor','rider','seva_provider','anchor','admin','super_admin')),
  village_id   text references villages(id) on delete set null,
  is_verified  boolean not null default false,
  setu_score   integer not null default 500 check (setu_score between 0 and 999),
  language     text not null default 'hi',
  fcm_token    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_profiles_role       on profiles(role);
create index if not exists idx_profiles_village_id on profiles(village_id);
create index if not exists idx_profiles_phone      on profiles(phone);
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────────────────────
create table if not exists categories (
  id         text primary key default gen_random_uuid()::text,
  name       text    not null,
  name_hindi text,
  icon       text    not null default '🛒',
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_categories_updated_at before update on categories
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- VENDORS
-- ─────────────────────────────────────────────────────────
create table if not exists vendors (
  id                uuid primary key default uuid_generate_v4(),
  owner_id          uuid references auth.users(id) on delete cascade,
  name              text    not null,
  name_hindi        text,
  category          text    not null,
  village_id        text    references villages(id) on delete set null,
  village           text,
  phone             text,
  image_url         text,
  rating            numeric(3,2) not null default 0.0 check (rating between 0 and 5),
  review_count      integer not null default 0,
  is_open           boolean not null default false,
  is_verified       boolean not null default false,
  is_active         boolean not null default true,
  delivery_radius   numeric(4,1) not null default 3.0,
  subscription_tier text not null default 'free' check (subscription_tier in ('free','pro','enterprise')),
  trust_score       integer not null default 500,
  lat               numeric(10,6),
  lng               numeric(10,6),
  kyc_status        text not null default 'pending' check (kyc_status in ('pending','submitted','approved','rejected')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_vendors_owner_id   on vendors(owner_id);
create index if not exists idx_vendors_village_id on vendors(village_id);
create index if not exists idx_vendors_category   on vendors(category);
create index if not exists idx_vendors_is_open    on vendors(is_open);
create index if not exists idx_vendors_is_active  on vendors(is_active);
create trigger trg_vendors_updated_at before update on vendors
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- VENDOR HOURS
-- ─────────────────────────────────────────────────────────
create table if not exists vendor_hours (
  id          uuid primary key default uuid_generate_v4(),
  vendor_id   uuid not null references vendors(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  open_time   time,
  close_time  time,
  is_closed   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_vendor_hours_vendor_id on vendor_hours(vendor_id);

-- ─────────────────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────────────────
create table if not exists products (
  id           uuid primary key default uuid_generate_v4(),
  vendor_id    uuid not null references vendors(id) on delete cascade,
  category_id  text references categories(id) on delete set null,
  name         text    not null,
  name_hindi   text,
  description  text,
  price        numeric(10,2) not null check (price > 0),
  mrp          numeric(10,2) check (mrp >= price),
  unit         text    not null default 'piece',
  stock        integer not null default 0 check (stock >= 0),
  image_url    text,
  is_available boolean not null default true,
  is_seasonal  boolean not null default false,
  category     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_products_vendor_id    on products(vendor_id);
create index if not exists idx_products_category_id  on products(category_id);
create index if not exists idx_products_is_available on products(is_available);
create index if not exists idx_products_name_trgm    on products using gin(name gin_trgm_ops);
create trigger trg_products_updated_at before update on products
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- RIDERS
-- ─────────────────────────────────────────────────────────
create table if not exists riders (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade,
  name             text not null,
  phone            text,
  village_id       text references villages(id) on delete set null,
  village          text,
  zone             text,
  vehicle_type     text not null default 'Bike',
  vehicle_number   text,
  is_online        boolean not null default false,
  is_active        boolean not null default true,
  is_verified      boolean not null default false,
  rating           numeric(3,2) not null default 0.0,
  total_deliveries integer not null default 0,
  today_deliveries integer not null default 0,
  today_earnings   numeric(10,2) not null default 0,
  total_earnings   numeric(10,2) not null default 0,
  cod_balance      numeric(10,2) not null default 0,
  kyc_status       text not null default 'pending' check (kyc_status in ('pending','submitted','approved','rejected')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_riders_user_id    on riders(user_id);
create index if not exists idx_riders_village_id on riders(village_id);
create index if not exists idx_riders_is_online  on riders(is_online);
create trigger trg_riders_updated_at before update on riders
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- RIDER LOCATIONS  (real-time GPS tracking)
-- Rows older than 48 h are pruned by pg_cron (see functions.sql)
-- ─────────────────────────────────────────────────────────
create table if not exists rider_locations (
  id             uuid primary key default uuid_generate_v4(),
  rider_id       uuid not null references riders(id) on delete cascade,
  lat            numeric(10,6) not null,
  lng            numeric(10,6) not null,
  accuracy       numeric(6,2),
  is_on_delivery boolean not null default false,
  recorded_at    timestamptz not null default now()
);
create index if not exists idx_rider_locations_rider_id    on rider_locations(rider_id);
create index if not exists idx_rider_locations_recorded_at on rider_locations(recorded_at desc);
create index if not exists idx_rider_locations_composite   on rider_locations(rider_id, recorded_at desc);

-- ─────────────────────────────────────────────────────────
-- ORDER NUMBER SEQUENCE
-- Replaces the racy COUNT(*)+1 pattern in place_order().
-- ─────────────────────────────────────────────────────────
create sequence if not exists order_number_seq start 1;

-- ─────────────────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────────────────
create table if not exists orders (
  id               uuid primary key default uuid_generate_v4(),
  order_number     text unique not null,
  customer_id      uuid references auth.users(id) on delete set null,
  customer_name    text,
  vendor_id        uuid references vendors(id) on delete set null,
  vendor_name      text,
  rider_id         uuid references riders(id) on delete set null,
  rider_name       text,
  village_id       text references villages(id) on delete set null,
  village          text,
  status           text not null default 'pending'
                     check (status in ('pending','confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled')),
  payment_method   text not null default 'COD'
                     check (payment_method in ('COD','UPI','wallet','credit')),
  payment_status   text not null default 'pending'
                     check (payment_status in ('pending','paid','collected','refunded','failed')),
  subtotal         numeric(10,2) not null default 0,
  delivery_fee     numeric(10,2) not null default 0,
  platform_fee     numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  is_cod           boolean not null default false,
  cancel_reason    text,
  delivery_address text,
  delivery_notes   text,
  vendor_rating    integer check (vendor_rating between 1 and 5),
  rider_rating     integer check (rider_rating between 1 and 5),
  rating_comment   text,
  is_rated         boolean not null default false,
  confirmed_at     timestamptz,
  ready_at         timestamptz,
  picked_up_at     timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_orders_customer_id  on orders(customer_id);
create index if not exists idx_orders_vendor_id    on orders(vendor_id);
create index if not exists idx_orders_rider_id     on orders(rider_id);
create index if not exists idx_orders_status       on orders(status);
create index if not exists idx_orders_village_id   on orders(village_id);
create index if not exists idx_orders_created_at   on orders(created_at desc);
create index if not exists idx_orders_order_number on orders(order_number);
create trigger trg_orders_updated_at before update on orders
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- ORDER ITEMS
-- ─────────────────────────────────────────────────────────
create table if not exists order_items (
  id         uuid primary key default uuid_generate_v4(),
  order_id   uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name       text not null,
  qty        integer not null check (qty > 0),
  price      numeric(10,2) not null check (price > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_order_items_order_id   on order_items(order_id);
create index if not exists idx_order_items_product_id on order_items(product_id);

-- ─────────────────────────────────────────────────────────
-- SEVA PROVIDERS
-- ─────────────────────────────────────────────────────────
create table if not exists seva_providers (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade,
  name             text not null,
  category         text not null,
  skills           text[] not null default '{}',
  village_id       text references villages(id) on delete set null,
  village          text,
  phone            text,
  image_url        text,
  rating           numeric(3,2) not null default 0.0,
  review_count     integer not null default 0,
  is_available     boolean not null default false,
  is_verified      boolean not null default false,
  hourly_rate      numeric(8,2) not null default 0,
  experience       text,
  jobs_completed   integer not null default 0,
  monthly_earnings numeric(10,2) not null default 0,
  trust_score      integer not null default 500,
  kyc_status       text not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_seva_providers_user_id    on seva_providers(user_id);
create index if not exists idx_seva_providers_village_id on seva_providers(village_id);
create index if not exists idx_seva_providers_category   on seva_providers(category);
create trigger trg_seva_providers_updated_at before update on seva_providers
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- SEVA JOBS
-- ─────────────────────────────────────────────────────────
create table if not exists seva_jobs (
  id            uuid primary key default uuid_generate_v4(),
  provider_id   uuid references seva_providers(id) on delete set null,
  customer_id   uuid references auth.users(id) on delete set null,
  customer_name text,
  village_id    text references villages(id) on delete set null,
  title         text not null,
  description   text,
  category      text not null,
  amount        numeric(10,2) not null,
  urgency       text not null default 'flexible'
                  check (urgency in ('today','tomorrow','weekend','flexible')),
  status        text not null default 'open'
                  check (status in ('open','accepted','in_progress','completed','cancelled')),
  address       text,
  phone         text,
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_seva_jobs_provider_id on seva_jobs(provider_id);
create index if not exists idx_seva_jobs_customer_id on seva_jobs(customer_id);
create index if not exists idx_seva_jobs_village_id  on seva_jobs(village_id);
create index if not exists idx_seva_jobs_status      on seva_jobs(status);
create trigger trg_seva_jobs_updated_at before update on seva_jobs
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- WALLETS
-- ─────────────────────────────────────────────────────────
create table if not exists wallets (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid unique not null references auth.users(id) on delete cascade,
  balance    numeric(12,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wallets_user_id on wallets(user_id);
create trigger trg_wallets_updated_at before update on wallets
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- WALLET TRANSACTIONS
-- ─────────────────────────────────────────────────────────
create table if not exists wallet_transactions (
  id          uuid primary key default uuid_generate_v4(),
  wallet_id   uuid not null references wallets(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('credit','debit')),
  amount      numeric(12,2) not null check (amount > 0),
  description text not null,
  reference   text,
  status      text not null default 'completed'
                check (status in ('pending','completed','failed','refunded')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_wallet_txns_wallet_id  on wallet_transactions(wallet_id);
create index if not exists idx_wallet_txns_user_id    on wallet_transactions(user_id);
create index if not exists idx_wallet_txns_created_at on wallet_transactions(created_at desc);

-- ─────────────────────────────────────────────────────────
-- PAYMENT ORDERS  (Razorpay order tracking)
-- ─────────────────────────────────────────────────────────
create table if not exists payment_orders (
  id                uuid primary key default uuid_generate_v4(),
  razorpay_order_id text unique not null,
  order_id          uuid references orders(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete cascade,
  amount            numeric(10,2) not null,
  currency          text not null default 'INR',
  status            text not null default 'created'
                      check (status in ('created','attempted','paid','failed')),
  notes             jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_payment_orders_order_id on payment_orders(order_id);
create index if not exists idx_payment_orders_user_id  on payment_orders(user_id);

-- ─────────────────────────────────────────────────────────
-- PAYMENT EVENTS  (Webhook log + idempotency store)
-- Canonical definition — was only in migration 002 before.
-- event_id unique constraint is the idempotency key:
--   INSERT ... ON CONFLICT (event_id) DO NOTHING
-- ensures replayed webhooks are silently swallowed.
-- ─────────────────────────────────────────────────────────
create table if not exists payment_events (
  id           uuid primary key default uuid_generate_v4(),
  event_id     text unique not null,   -- Razorpay event ID — dedup key
  type         text not null,          -- payment.captured, order.paid, refund.created…
  payload      jsonb not null,
  processed_at timestamptz,            -- null = not yet processed by webhook handler
  created_at   timestamptz not null default now()
);
create index if not exists idx_payment_events_event_id     on payment_events(event_id);
create index if not exists idx_payment_events_processed_at on payment_events(processed_at) where processed_at is null;
create index if not exists idx_payment_events_created_at   on payment_events(created_at desc);

-- ─────────────────────────────────────────────────────────
-- WALLET TOPUPS  (Verified via Razorpay webhook)
-- ─────────────────────────────────────────────────────────
create table if not exists wallet_topups (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  amount            numeric(10,2) not null,
  payment_id        text,
  razorpay_order_id text unique,
  status            text not null default 'pending'
                      check (status in ('pending','completed','failed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_wallet_topups_user_id on wallet_topups(user_id);

-- ─────────────────────────────────────────────────────────
-- CREDIT ACCOUNTS
-- ─────────────────────────────────────────────────────────
create table if not exists credit_accounts (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid unique not null references auth.users(id) on delete cascade,
  credit_limit   numeric(12,2) not null default 0,
  outstanding    numeric(12,2) not null default 0 check (outstanding >= 0),
  repayment_rate numeric(5,2)  not null default 100,
  status         text not null default 'active'
                   check (status in ('active','suspended','closed')),
  score          integer not null default 500,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_credit_accounts_user_id on credit_accounts(user_id);
create trigger trg_credit_accounts_updated_at before update on credit_accounts
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- CREDIT TRANSACTIONS
-- ─────────────────────────────────────────────────────────
create table if not exists credit_transactions (
  id         uuid primary key default uuid_generate_v4(),
  account_id uuid not null references credit_accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('disbursement','repayment')),
  amount     numeric(12,2) not null check (amount > 0),
  purpose    text,
  status     text not null default 'active'
               check (status in ('active','repaid','overdue','defaulted')),
  due_date   date,
  repaid_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_credit_txns_account_id on credit_transactions(account_id);
create index if not exists idx_credit_txns_user_id    on credit_transactions(user_id);

-- ─────────────────────────────────────────────────────────
-- CREDIT DISBURSEMENTS  (Application tracking)
-- ─────────────────────────────────────────────────────────
create table if not exists credit_disbursements (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  amount           numeric(10,2) not null,
  purpose          text,
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected','disbursed')),
  repayment_due_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_credit_disbursements_user_id on credit_disbursements(user_id);

-- ─────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null default 'system'
               check (type in ('order','credit','promo','scheme','system')),
  title      text not null,
  body       text not null,
  data       jsonb,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_id    on notifications(user_id);
create index if not exists idx_notifications_is_read    on notifications(is_read);
create index if not exists idx_notifications_created_at on notifications(created_at desc);

-- ─────────────────────────────────────────────────────────
-- SUPPORT TICKETS
-- ─────────────────────────────────────────────────────────
create table if not exists support_tickets (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  order_id    uuid references orders(id) on delete set null,
  subject     text not null,
  status      text not null default 'open'
                check (status in ('open','in_progress','resolved','closed')),
  priority    text not null default 'medium'
                check (priority in ('low','medium','high','critical')),
  messages    jsonb not null default '[]',
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_support_tickets_user_id    on support_tickets(user_id);
create index if not exists idx_support_tickets_status     on support_tickets(status);
create index if not exists idx_support_tickets_created_at on support_tickets(created_at desc);
create trigger trg_support_tickets_updated_at before update on support_tickets
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────────────────
create table if not exists audit_log (
  id         uuid primary key default uuid_generate_v4(),
  actor_id   uuid references auth.users(id) on delete set null,
  actor      text not null default 'system',
  action     text not null,
  target     text,
  detail     text,
  ip         text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_log_actor_id   on audit_log(actor_id);
create index if not exists idx_audit_log_action     on audit_log(action);
create index if not exists idx_audit_log_created_at on audit_log(created_at desc);

-- ─────────────────────────────────────────────────────────
-- SCHEMES
-- ─────────────────────────────────────────────────────────
create table if not exists schemes (
  id           uuid primary key default uuid_generate_v4(),
  name         text    not null,
  description  text    not null,
  category     text    not null,
  benefit      text,
  how_to_apply text,
  deadline     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_schemes_updated_at before update on schemes
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- COD DEPOSITS
-- ─────────────────────────────────────────────────────────
create table if not exists cod_deposits (
  id                 uuid primary key default uuid_generate_v4(),
  rider_id           uuid not null references riders(id) on delete cascade,
  amount             numeric(10,2) not null check (amount > 0),
  denominations      jsonb,
  status             text not null default 'pending_confirmation'
                       check (status in ('pending_confirmation','confirmed','disputed','rejected')),
  admin_confirmed_by uuid references auth.users(id) on delete set null,
  admin_confirmed_at timestamptz,
  rejection_reason   text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_cod_deposits_rider_id   on cod_deposits(rider_id);
create index if not exists idx_cod_deposits_status     on cod_deposits(status);
create index if not exists idx_cod_deposits_created_at on cod_deposits(created_at desc);
create trigger trg_cod_deposits_updated_at before update on cod_deposits
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- KYC RECORDS
-- Aadhaar stored as pgcrypto AES-256 encrypted bytea.
-- Raw column never readable via RLS; use store_aadhaar() /
-- decrypt_aadhaar() security-definer functions exclusively.
-- Key: Supabase Vault secret named "aadhaar_key".
-- ─────────────────────────────────────────────────────────
create table if not exists kyc_records (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  type              text not null
                      check (type in ('aadhaar','pan','driving_license','vehicle_rc','gstin','shop_photo','selfie')),
  status            text not null default 'pending'
                      check (status in ('pending','submitted','verified','rejected')),
  doc_url           text,
  -- Aadhaar encrypted with pgcrypto symmetric cipher; never exposed raw
  aadhaar_encrypted bytea,
  -- Last 4 digits in clear text only — safe for display/search
  aadhaar_last4     char(4),
  failure_reason    text,
  verified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_kyc_records_user_id on kyc_records(user_id);
create index if not exists idx_kyc_records_type    on kyc_records(type);
create trigger trg_kyc_records_updated_at before update on kyc_records
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- DISPUTES  (Anchor portal — dispute resolution)
-- ─────────────────────────────────────────────────────────
create table if not exists disputes (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid references orders(id) on delete set null,
  raised_by   uuid not null references auth.users(id) on delete cascade,
  against     uuid references auth.users(id) on delete set null,
  village_id  text references villages(id) on delete set null,
  type        text not null default 'order'
                check (type in ('order','payment','quality','delivery','fraud','other')),
  status      text not null default 'open'
                check (status in ('open','under_review','resolved','escalated','closed')),
  description text not null,
  resolution  text,
  anchor_id   uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_disputes_village_id on disputes(village_id);
create index if not exists idx_disputes_raised_by  on disputes(raised_by);
create index if not exists idx_disputes_status     on disputes(status);
create index if not exists idx_disputes_order_id   on disputes(order_id);
create index if not exists idx_disputes_created_at on disputes(created_at desc);
create trigger trg_disputes_updated_at before update on disputes
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- ESCALATIONS  (Anchor -> Admin pipeline)
-- ─────────────────────────────────────────────────────────
create table if not exists escalations (
  id           uuid primary key default uuid_generate_v4(),
  dispute_id   uuid references disputes(id) on delete set null,
  village_id   text references villages(id) on delete set null,
  escalated_by uuid not null references auth.users(id) on delete cascade,
  assigned_to  uuid references auth.users(id) on delete set null,
  priority     text not null default 'medium'
                 check (priority in ('low','medium','high','critical')),
  status       text not null default 'open'
                 check (status in ('open','in_review','resolved','closed')),
  subject      text not null,
  notes        text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_escalations_village_id   on escalations(village_id);
create index if not exists idx_escalations_escalated_by on escalations(escalated_by);
create index if not exists idx_escalations_status       on escalations(status);
create index if not exists idx_escalations_created_at   on escalations(created_at desc);
create trigger trg_escalations_updated_at before update on escalations
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- NOTICEBOARD  (Anchor portal — village announcements)
-- ─────────────────────────────────────────────────────────
create table if not exists noticeboard (
  id         uuid primary key default uuid_generate_v4(),
  village_id text not null references villages(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text not null,
  category   text not null default 'general'
               check (category in ('general','alert','scheme','market','health','weather','other')),
  is_pinned  boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_noticeboard_village_id on noticeboard(village_id);
create index if not exists idx_noticeboard_author_id  on noticeboard(author_id);
create index if not exists idx_noticeboard_created_at on noticeboard(created_at desc);
create index if not exists idx_noticeboard_is_pinned  on noticeboard(is_pinned) where is_pinned = true;
create trigger trg_noticeboard_updated_at before update on noticeboard
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────
-- VENDOR LOCATIONS  (from migration 003 — canonical here)
-- ─────────────────────────────────────────────────────────
create table if not exists vendor_locations (
  id         uuid primary key default uuid_generate_v4(),
  vendor_id  uuid not null references vendors(id) on delete cascade,
  lat        numeric(10,6) not null,
  lng        numeric(10,6) not null,
  address    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vendor_locations_vendor_id on vendor_locations(vendor_id);

-- ════════════════════════════════════════════════════════
-- Enable Realtime on key tables
-- ════════════════════════════════════════════════════════
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table rider_locations;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table disputes;
alter publication supabase_realtime add table noticeboard;
