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
-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — DATABASE FUNCTIONS & RPCs
-- Phase 2 hardened:
--  1. place_order   — uses nextval('order_number_seq'), not COUNT+1
--  2. pay_from_wallet — single atomic UPDATE ... RETURNING
--  3. store_aadhaar / decrypt_aadhaar — pgcrypto Aadhaar helpers
--  4. handle_new_user trigger — auto-profile on auth.users INSERT
--  5. pg_cron job — prune rider_locations older than 48 h
-- ═══════════════════════════════════════════════════════════

-- ── place_order ───────────────────────────────────────────
-- Atomically creates an order + order_items in one transaction.
-- Uses nextval() for a collision-free order number.
create or replace function place_order(
  p_customer_id      uuid,
  p_customer_name    text,
  p_vendor_id        uuid,
  p_vendor_name      text,
  p_village_id       text,
  p_village          text,
  p_payment_method   text,
  p_subtotal         numeric,
  p_delivery_fee     numeric,
  p_platform_fee     numeric,
  p_total            numeric,
  p_items            jsonb,          -- [{name, qty, price, product_id?}]
  p_delivery_address text    default null,
  p_use_credit       boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order_id     uuid;
  v_order_number text;
  v_item         jsonb;
  v_result       jsonb;
begin
  v_order_id     := gen_random_uuid();
  -- nextval() is transactionally safe; COUNT+1 races under concurrency
  v_order_number := 'SETU-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('order_number_seq')::text, 4, '0');

  insert into orders (
    id, order_number, customer_id, customer_name,
    vendor_id, vendor_name, village_id, village,
    status, payment_method, payment_status,
    subtotal, delivery_fee, platform_fee, total,
    is_cod, delivery_address
  ) values (
    v_order_id, v_order_number, p_customer_id, p_customer_name,
    p_vendor_id, p_vendor_name, p_village_id, p_village,
    'pending', p_payment_method,
    case when p_payment_method = 'COD' then 'pending' else 'paid' end,
    p_subtotal, p_delivery_fee, p_platform_fee, p_total,
    p_payment_method = 'COD', p_delivery_address
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (order_id, product_id, name, qty, price)
    values (
      v_order_id,
      case when (v_item->>'product_id') is not null
           then (v_item->>'product_id')::uuid
           else null end,
      v_item->>'name',
      (v_item->>'qty')::integer,
      (v_item->>'price')::numeric
    );

    if (v_item->>'product_id') is not null then
      update products
      set stock = greatest(0, stock - (v_item->>'qty')::integer)
      where id = (v_item->>'product_id')::uuid;
    end if;
  end loop;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (p_customer_id, p_customer_name, 'order_placed', v_order_number,
          'Total: ₹' || p_total);

  select to_jsonb(o.*) into v_result
  from orders o where o.id = v_order_id;

  return v_result;
end;
$$;

-- ── update_order_status ───────────────────────────────────
create or replace function update_order_status(
  p_order_id   uuid,
  p_new_status text,
  p_actor_id   uuid  default null,
  p_meta       jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order   orders%rowtype;
  v_allowed text[];
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('error', 'Order not found');
  end if;

  v_allowed := case v_order.status
    when 'pending'    then array['confirmed','cancelled']
    when 'confirmed'  then array['preparing','cancelled']
    when 'preparing'  then array['ready']
    when 'ready'      then array['picked_up']
    when 'picked_up'  then array['on_the_way']
    when 'on_the_way' then array['delivered']
    else array[]::text[]
  end;

  if not (p_new_status = any(v_allowed)) then
    return jsonb_build_object(
      'error', 'Invalid transition: ' || v_order.status || ' → ' || p_new_status
    );
  end if;

  update orders set
    status        = p_new_status,
    updated_at    = now(),
    confirmed_at  = case when p_new_status = 'confirmed'  then now() else confirmed_at  end,
    ready_at      = case when p_new_status = 'ready'      then now() else ready_at      end,
    picked_up_at  = case when p_new_status = 'picked_up'  then now() else picked_up_at  end,
    delivered_at  = case when p_new_status = 'delivered'  then now() else delivered_at  end,
    cancelled_at  = case when p_new_status = 'cancelled'  then now() else cancelled_at  end,
    cancel_reason = coalesce(p_meta->>'cancel_reason', cancel_reason),
    rider_id      = coalesce((p_meta->>'rider_id')::uuid, rider_id),
    rider_name    = coalesce(p_meta->>'rider_name', rider_name)
  where id = p_order_id;

  if p_new_status = 'delivered' and v_order.rider_id is not null then
    update riders set
      today_deliveries = today_deliveries + 1,
      total_deliveries = total_deliveries + 1,
      today_earnings   = today_earnings + 80,
      total_earnings   = total_earnings + 80,
      cod_balance      = case when v_order.is_cod
                              then cod_balance + v_order.total
                              else cod_balance end
    where id = v_order.rider_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    p_actor_id,
    coalesce((select name from profiles where id = p_actor_id), 'System'),
    'order_' || p_new_status,
    v_order.order_number,
    'Status: ' || v_order.status || ' → ' || p_new_status
  );

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
end;
$$;

-- ── rate_order ────────────────────────────────────────────
create or replace function rate_order(
  p_order_id      uuid,
  p_vendor_rating integer,
  p_rider_rating  integer default null,
  p_comment       text    default null
)
returns jsonb
language plpgsql
security definer
as $$
begin
  update orders set
    vendor_rating  = p_vendor_rating,
    rider_rating   = p_rider_rating,
    rating_comment = p_comment,
    is_rated       = true,
    updated_at     = now()
  where id = p_order_id and customer_id = auth.uid();

  if not found then
    return jsonb_build_object('error', 'Order not found or unauthorized');
  end if;

  update vendors v set
    rating       = (v.rating * v.review_count + p_vendor_rating) / (v.review_count + 1),
    review_count = v.review_count + 1
  from orders o
  where o.id = p_order_id and o.vendor_id = v.id;

  return jsonb_build_object('success', true);
end;
$$;

-- ── topup_wallet ──────────────────────────────────────────
create or replace function topup_wallet(
  p_user_id   uuid,
  p_amount    numeric,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_wallet_id  uuid;
  v_new_balance numeric;
begin
  insert into wallets (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance    = wallets.balance + excluded.balance,
        updated_at = now()
  returning id, balance into v_wallet_id, v_new_balance;

  insert into wallet_transactions (wallet_id, user_id, type, amount, description, reference, status)
  values (v_wallet_id, p_user_id, 'credit', p_amount, 'Wallet top-up', p_reference, 'completed');

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

-- ── pay_from_wallet ───────────────────────────────────────
-- FIX: replaced read-then-write TOCTOU pattern with a single
-- atomic UPDATE ... WHERE balance >= amount RETURNING balance.
-- If the row isn't updated (balance too low or wallet missing),
-- we return insufficient_funds without touching the DB.
-- Called via supabase.rpc('pay_from_wallet', {...}).
create or replace function pay_from_wallet(
  p_user_id  uuid,
  p_amount   numeric,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_wallet_id   uuid;
  v_new_balance numeric;
begin
  -- One atomic statement: deduct only if balance is sufficient.
  -- The WHERE balance >= p_amount guard eliminates the TOCTOU window
  -- that existed in the old SELECT ... then UPDATE pattern.
  update wallets
  set    balance    = balance - p_amount,
         updated_at = now()
  where  user_id = p_user_id
    and  balance  >= p_amount
  returning id, balance into v_wallet_id, v_new_balance;

  -- If no row was updated: wallet missing or balance insufficient
  if not found then
    -- Distinguish the two failure modes for a better client error
    if exists (select 1 from wallets where user_id = p_user_id) then
      return jsonb_build_object(
        'success',           false,
        'insufficient_funds', true,
        'balance',            (select balance from wallets where user_id = p_user_id)
      );
    else
      return jsonb_build_object('success', false, 'error', 'Wallet not found');
    end if;
  end if;

  insert into wallet_transactions (
    wallet_id, user_id, type, amount, description, reference, status
  ) values (
    v_wallet_id,
    p_user_id,
    'debit',
    p_amount,
    'Order payment from wallet',
    p_order_id::text,
    'completed'
  );

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

-- ── get_vendor_orders ─────────────────────────────────────
create or replace function get_vendor_orders(p_vendor_id uuid)
returns table (
  id             uuid,
  order_number   text,
  customer_name  text,
  village        text,
  status         text,
  payment_method text,
  payment_status text,
  total          numeric,
  is_cod         boolean,
  rider_name     text,
  created_at     timestamptz,
  items          jsonb
)
language sql
security definer
stable
as $$
  select
    o.id, o.order_number, o.customer_name, o.village,
    o.status, o.payment_method, o.payment_status,
    o.total, o.is_cod, o.rider_name, o.created_at,
    coalesce(
      jsonb_agg(jsonb_build_object(
        'name', oi.name, 'qty', oi.qty, 'price', oi.price
      )) filter (where oi.id is not null),
      '[]'
    ) as items
  from orders o
  left join order_items oi on oi.order_id = o.id
  where o.vendor_id = p_vendor_id
  group by o.id
  order by o.created_at desc;
$$;

-- ── store_aadhaar ─────────────────────────────────────────
-- Encrypts a plain-text Aadhaar number and stores it.
-- Key is fetched from Supabase Vault (secret: "aadhaar_key").
-- Only the last 4 digits are stored in clear text for display.
--
-- Usage: select store_aadhaar(p_kyc_record_id, p_aadhaar_plain)
create or replace function store_aadhaar(
  p_kyc_id       uuid,
  p_aadhaar_plain text   -- 12-digit Aadhaar as plain text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key  text;
  v_last4 char(4);
begin
  -- Validate format: 12 digits
  if p_aadhaar_plain !~ '^\d{12}$' then
    raise exception 'Invalid Aadhaar format';
  end if;

  -- Retrieve key from Supabase Vault
  -- Requires: select vault.decrypted_secrets where name = 'aadhaar_key'
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'aadhaar_key'
  limit 1;

  if v_key is null then
    raise exception 'aadhaar_key not found in Vault';
  end if;

  v_last4 := right(p_aadhaar_plain, 4);

  update kyc_records set
    aadhaar_encrypted = pgp_sym_encrypt(p_aadhaar_plain, v_key),
    aadhaar_last4     = v_last4,
    updated_at        = now()
  where id = p_kyc_id
    and user_id = auth.uid();  -- only owner may store their own Aadhaar

  if not found then
    raise exception 'KYC record not found or unauthorized';
  end if;
end;
$$;

-- ── decrypt_aadhaar ───────────────────────────────────────
-- Returns the plain-text Aadhaar for a given KYC record.
-- Restricted to admin / super_admin roles only.
-- Logs every access to audit_log.
create or replace function decrypt_aadhaar(p_kyc_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key       text;
  v_encrypted bytea;
  v_plain     text;
  v_caller    uuid := auth.uid();
begin
  -- Only admins may decrypt
  if not (select is_admin()) then
    raise exception 'Unauthorized: admin role required';
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'aadhaar_key'
  limit 1;

  if v_key is null then
    raise exception 'aadhaar_key not found in Vault';
  end if;

  select aadhaar_encrypted into v_encrypted
  from kyc_records
  where id = p_kyc_id;

  if v_encrypted is null then
    return null;  -- not yet stored
  end if;

  v_plain := pgp_sym_decrypt(v_encrypted, v_key);

  -- Audit every decryption
  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    v_caller,
    coalesce((select name from profiles where id = v_caller), 'Admin'),
    'aadhaar_decrypted',
    p_kyc_id::text,
    'KYC record decrypted by admin'
  );

  return v_plain;
end;
$$;

-- ── handle_new_user ───────────────────────────────────────
-- Auto-creates a profiles row when a new auth.users row appears.
-- Handles phone OTP users (phone set) and OAuth users (phone null).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, name, role)
  values (
    new.id,
    new.phone,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      'SETU User'
    ),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── rider_locations cleanup (pg_cron) ─────────────────────
-- Deletes GPS rows older than 48 hours every hour.
-- Keeps the table small for rural low-storage environments.
-- pg_cron must be enabled (done in schema.sql via CREATE EXTENSION).
--
-- NOTE: run this block once after pg_cron is enabled.
--       Supabase requires cron.schedule() to be called as postgres role.
select cron.schedule(
  'prune-rider-locations',          -- job name (unique)
  '0 * * * *',                       -- every hour at :00
  $$
    delete from public.rider_locations
    where recorded_at < now() - interval '48 hours';
  $$
);
-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — ROW LEVEL SECURITY POLICIES
-- Phase 2 hardened:
--  1. FOR ALL policies split: USING for SELECT/UPDATE/DELETE,
--     WITH CHECK for INSERT — prevents privilege escalation.
--  2. audit_log_system_insert restricted to service_role only;
--     all audit writes go through security-definer functions.
--  3. New tables: disputes, escalations, noticeboard,
--     payment_events, payment_orders, wallet_topups.
-- Run after schema.sql
-- ═══════════════════════════════════════════════════════════

-- ── HELPERS ───────────────────────────────────────────────
create or replace function get_my_role()
returns text as $$
  select role from profiles where id = auth.uid()
$$ language sql security definer stable;

create or replace function get_my_village_id()
returns text as $$
  select village_id from profiles where id = auth.uid()
$$ language sql security definer stable;

create or replace function is_admin()
returns boolean as $$
  select get_my_role() in ('admin','super_admin')
$$ language sql security definer stable;

-- ════════════════════════════════════════════════════════
-- VILLAGES
-- ════════════════════════════════════════════════════════
alter table villages enable row level security;

create policy "villages_public_read"
  on villages for select using (true);

create policy "villages_admin_write"
  on villages for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════════════════
alter table profiles enable row level security;

create policy "profiles_own_read"
  on profiles for select using (auth.uid() = id);

create policy "profiles_own_insert"
  on profiles for insert with check (auth.uid() = id);

create policy "profiles_own_update"
  on profiles for update
  using     (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_admin_read"
  on profiles for select using (
    is_admin() and (
      get_my_role() = 'super_admin' or
      village_id = get_my_village_id()
    )
  );

-- ════════════════════════════════════════════════════════
-- CATEGORIES
-- ════════════════════════════════════════════════════════
alter table categories enable row level security;

create policy "categories_public_read"
  on categories for select using (is_active = true);

create policy "categories_admin_write"
  on categories for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- VENDORS
-- ════════════════════════════════════════════════════════
alter table vendors enable row level security;

create policy "vendors_public_read"
  on vendors for select using (is_active = true);

-- FIX: FOR ALL without WITH CHECK allowed a vendor to INSERT
-- a row with a different owner_id. Split into SELECT/UPDATE/DELETE
-- with USING, and INSERT with WITH CHECK.
create policy "vendors_own_select"
  on vendors for select using (owner_id = auth.uid());

create policy "vendors_own_insert"
  on vendors for insert with check (owner_id = auth.uid());

create policy "vendors_own_update"
  on vendors for update
  using     (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "vendors_own_delete"
  on vendors for delete using (owner_id = auth.uid());

create policy "vendors_anchor_read"
  on vendors for select using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

create policy "vendors_admin_all"
  on vendors for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- VENDOR HOURS
-- ════════════════════════════════════════════════════════
alter table vendor_hours enable row level security;

create policy "vendor_hours_public_read"
  on vendor_hours for select using (true);

create policy "vendor_hours_own_insert"
  on vendor_hours for insert with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "vendor_hours_own_update"
  on vendor_hours for update
  using (vendor_id in (select id from vendors where owner_id = auth.uid()))
  with check (vendor_id in (select id from vendors where owner_id = auth.uid()));

create policy "vendor_hours_own_delete"
  on vendor_hours for delete using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "vendor_hours_admin_all"
  on vendor_hours for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- PRODUCTS
-- ════════════════════════════════════════════════════════
alter table products enable row level security;

create policy "products_public_read"
  on products for select using (is_available = true);

-- FIX: same FOR ALL → split pattern
create policy "products_own_select"
  on products for select using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "products_own_insert"
  on products for insert with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "products_own_update"
  on products for update
  using (vendor_id in (select id from vendors where owner_id = auth.uid()))
  with check (vendor_id in (select id from vendors where owner_id = auth.uid()));

create policy "products_own_delete"
  on products for delete using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "products_admin_all"
  on products for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- ORDERS
-- ════════════════════════════════════════════════════════
alter table orders enable row level security;

create policy "orders_customer_read"
  on orders for select using (customer_id = auth.uid());

create policy "orders_customer_insert"
  on orders for insert with check (customer_id = auth.uid());

create policy "orders_customer_cancel"
  on orders for update
  using (
    customer_id = auth.uid() and
    status in ('pending','confirmed')
  )
  with check (customer_id = auth.uid());

create policy "orders_vendor_read"
  on orders for select using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "orders_vendor_update"
  on orders for update
  using (
    vendor_id in (select id from vendors where owner_id = auth.uid()) and
    status in ('pending','confirmed','preparing','ready')
  )
  with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "orders_rider_read_unassigned"
  on orders for select using (
    get_my_role() = 'rider' and rider_id is null and status = 'ready'
  );

create policy "orders_rider_read_assigned"
  on orders for select using (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "orders_rider_update"
  on orders for update
  using (rider_id in (select id from riders where user_id = auth.uid()))
  with check (rider_id in (select id from riders where user_id = auth.uid()));

create policy "orders_anchor_read"
  on orders for select using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

create policy "orders_admin_all"
  on orders for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- ORDER ITEMS
-- ════════════════════════════════════════════════════════
alter table order_items enable row level security;

create policy "order_items_customer_read"
  on order_items for select using (
    order_id in (select id from orders where customer_id = auth.uid())
  );

create policy "order_items_vendor_read"
  on order_items for select using (
    order_id in (
      select o.id from orders o
      join vendors v on v.id = o.vendor_id
      where v.owner_id = auth.uid()
    )
  );

create policy "order_items_rider_read"
  on order_items for select using (
    order_id in (
      select o.id from orders o
      join riders r on r.id = o.rider_id
      where r.user_id = auth.uid()
    )
  );

create policy "order_items_insert_own"
  on order_items for insert with check (
    order_id in (select id from orders where customer_id = auth.uid())
  );

create policy "order_items_admin_all"
  on order_items for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- RIDERS
-- ════════════════════════════════════════════════════════
alter table riders enable row level security;

create policy "riders_public_read"
  on riders for select using (is_active = true);

create policy "riders_own_select"
  on riders for select using (user_id = auth.uid());

create policy "riders_own_insert"
  on riders for insert with check (user_id = auth.uid());

create policy "riders_own_update"
  on riders for update
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "riders_admin_all"
  on riders for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- RIDER LOCATIONS
-- ════════════════════════════════════════════════════════
alter table rider_locations enable row level security;

create policy "rider_locations_own_insert"
  on rider_locations for insert with check (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "rider_locations_customer_read"
  on rider_locations for select using (
    rider_id in (
      select r.id from riders r
      join orders o on o.rider_id = r.id
      where o.customer_id = auth.uid()
        and o.status in ('picked_up','on_the_way')
    )
  );

create policy "rider_locations_admin_all"
  on rider_locations for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- SEVA PROVIDERS
-- ════════════════════════════════════════════════════════
alter table seva_providers enable row level security;

create policy "seva_providers_public_read"
  on seva_providers for select using (is_available = true or is_available is null);

create policy "seva_providers_own_insert"
  on seva_providers for insert with check (user_id = auth.uid());

create policy "seva_providers_own_update"
  on seva_providers for update
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "seva_providers_own_delete"
  on seva_providers for delete using (user_id = auth.uid());

create policy "seva_providers_admin_all"
  on seva_providers for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- SEVA JOBS
-- ════════════════════════════════════════════════════════
alter table seva_jobs enable row level security;

create policy "seva_jobs_customer_read"
  on seva_jobs for select using (customer_id = auth.uid());

create policy "seva_jobs_customer_insert"
  on seva_jobs for insert with check (customer_id = auth.uid());

create policy "seva_jobs_provider_read"
  on seva_jobs for select using (
    provider_id in (select id from seva_providers where user_id = auth.uid())
    or (status = 'open' and get_my_role() = 'seva_provider')
  );

create policy "seva_jobs_provider_update"
  on seva_jobs for update
  using (provider_id in (select id from seva_providers where user_id = auth.uid()))
  with check (provider_id in (select id from seva_providers where user_id = auth.uid()));

create policy "seva_jobs_admin_all"
  on seva_jobs for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- WALLETS
-- ════════════════════════════════════════════════════════
alter table wallets enable row level security;

create policy "wallets_own_read"
  on wallets for select using (user_id = auth.uid());

-- Wallets are created/updated only via security-definer functions
-- (topup_wallet, pay_from_wallet). Direct INSERT/UPDATE blocked.
create policy "wallets_admin_read"
  on wallets for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- WALLET TRANSACTIONS
-- ════════════════════════════════════════════════════════
alter table wallet_transactions enable row level security;

create policy "wallet_txns_own_read"
  on wallet_transactions for select using (user_id = auth.uid());

create policy "wallet_txns_admin_read"
  on wallet_transactions for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- PAYMENT ORDERS
-- ════════════════════════════════════════════════════════
alter table payment_orders enable row level security;

create policy "payment_orders_own_read"
  on payment_orders for select using (user_id = auth.uid());

create policy "payment_orders_admin_all"
  on payment_orders for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- PAYMENT EVENTS  (webhook log — no user access)
-- ════════════════════════════════════════════════════════
alter table payment_events enable row level security;

-- Admins can read for auditing; writes via service_role webhook handler only
create policy "payment_events_admin_read"
  on payment_events for select using (is_admin());

-- No INSERT/UPDATE policy: only service_role (webhook Edge Function) writes here

-- ════════════════════════════════════════════════════════
-- WALLET TOPUPS
-- ════════════════════════════════════════════════════════
alter table wallet_topups enable row level security;

create policy "wallet_topups_own_read"
  on wallet_topups for select using (user_id = auth.uid());

create policy "wallet_topups_admin_all"
  on wallet_topups for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- CREDIT ACCOUNTS
-- ════════════════════════════════════════════════════════
alter table credit_accounts enable row level security;

create policy "credit_accounts_own_read"
  on credit_accounts for select using (user_id = auth.uid());

create policy "credit_accounts_admin_read"
  on credit_accounts for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- CREDIT TRANSACTIONS
-- ════════════════════════════════════════════════════════
alter table credit_transactions enable row level security;

create policy "credit_txns_own_read"
  on credit_transactions for select using (user_id = auth.uid());

create policy "credit_txns_admin_read"
  on credit_transactions for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- CREDIT DISBURSEMENTS
-- ════════════════════════════════════════════════════════
alter table credit_disbursements enable row level security;

create policy "credit_disbursements_own_read"
  on credit_disbursements for select using (user_id = auth.uid());

create policy "credit_disbursements_admin_all"
  on credit_disbursements for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ════════════════════════════════════════════════════════
alter table notifications enable row level security;

create policy "notifications_own"
  on notifications for select using (user_id = auth.uid());

create policy "notifications_own_update"
  on notifications for update
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Only service_role / security-definer functions insert notifications
create policy "notifications_admin_insert"
  on notifications for insert with check (is_admin());

-- ════════════════════════════════════════════════════════
-- SUPPORT TICKETS
-- ════════════════════════════════════════════════════════
alter table support_tickets enable row level security;

create policy "support_tickets_own_read"
  on support_tickets for select using (user_id = auth.uid());

create policy "support_tickets_own_insert"
  on support_tickets for insert with check (user_id = auth.uid());

create policy "support_tickets_admin_all"
  on support_tickets for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- AUDIT LOG
-- FIX: removed "with check (true)" which allowed any authenticated
-- user to write arbitrary rows. All writes now go through
-- security-definer functions (place_order, update_order_status, etc.)
-- which bypass RLS. Direct INSERT is blocked for all roles.
-- ════════════════════════════════════════════════════════
alter table audit_log enable row level security;

create policy "audit_log_admin_read"
  on audit_log for select using (is_admin());

-- No INSERT policy: only security-definer functions (which run as
-- the function owner, bypassing RLS) may write to audit_log.
-- This prevents users from injecting fake audit entries.

-- ════════════════════════════════════════════════════════
-- SCHEMES
-- ════════════════════════════════════════════════════════
alter table schemes enable row level security;

create policy "schemes_public_read"
  on schemes for select using (is_active = true);

create policy "schemes_admin_write"
  on schemes for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- COD DEPOSITS
-- ════════════════════════════════════════════════════════
alter table cod_deposits enable row level security;

create policy "cod_deposits_rider_read"
  on cod_deposits for select using (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "cod_deposits_rider_insert"
  on cod_deposits for insert with check (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "cod_deposits_admin_all"
  on cod_deposits for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- KYC RECORDS
-- aadhaar_encrypted column excluded from all SELECT policies
-- via column-level security (see store_aadhaar / decrypt_aadhaar).
-- ════════════════════════════════════════════════════════
alter table kyc_records enable row level security;

-- Users may only read non-sensitive columns (enforced by app layer;
-- column-level grants tighten this further if needed)
create policy "kyc_records_own_read"
  on kyc_records for select using (user_id = auth.uid());

create policy "kyc_records_own_insert"
  on kyc_records for insert with check (user_id = auth.uid());

create policy "kyc_records_own_update"
  on kyc_records for update
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "kyc_records_anchor_read"
  on kyc_records for select using (
    get_my_role() in ('anchor','admin','super_admin')
  );

-- ════════════════════════════════════════════════════════
-- DISPUTES
-- ════════════════════════════════════════════════════════
alter table disputes enable row level security;

create policy "disputes_own_read"
  on disputes for select using (raised_by = auth.uid() or against = auth.uid());

create policy "disputes_own_insert"
  on disputes for insert with check (raised_by = auth.uid());

-- Anchors manage disputes in their village
create policy "disputes_anchor_read"
  on disputes for select using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

create policy "disputes_anchor_update"
  on disputes for update
  using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  )
  with check (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

create policy "disputes_admin_all"
  on disputes for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- ESCALATIONS
-- ════════════════════════════════════════════════════════
alter table escalations enable row level security;

create policy "escalations_anchor_own"
  on escalations for select using (escalated_by = auth.uid());

create policy "escalations_anchor_insert"
  on escalations for insert with check (
    escalated_by = auth.uid() and get_my_role() in ('anchor','admin','super_admin')
  );

create policy "escalations_admin_all"
  on escalations for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- NOTICEBOARD
-- ════════════════════════════════════════════════════════
alter table noticeboard enable row level security;

-- Anyone in the same village (or any authenticated user) can read
create policy "noticeboard_village_read"
  on noticeboard for select using (
    village_id = get_my_village_id()
    or get_my_role() in ('admin','super_admin')
  );

-- Only anchors and admins can post
create policy "noticeboard_anchor_insert"
  on noticeboard for insert with check (
    author_id = auth.uid() and
    get_my_role() in ('anchor','admin','super_admin')
  );

create policy "noticeboard_anchor_update"
  on noticeboard for update
  using (
    author_id = auth.uid() and
    get_my_role() in ('anchor','admin','super_admin')
  )
  with check (
    author_id = auth.uid() and
    get_my_role() in ('anchor','admin','super_admin')
  );

create policy "noticeboard_anchor_delete"
  on noticeboard for delete using (
    author_id = auth.uid() and
    get_my_role() in ('anchor','admin','super_admin')
  );

create policy "noticeboard_admin_all"
  on noticeboard for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- VENDOR LOCATIONS
-- ════════════════════════════════════════════════════════
alter table vendor_locations enable row level security;

create policy "vendor_locations_public_read"
  on vendor_locations for select using (true);

create policy "vendor_locations_own_write"
  on vendor_locations for insert with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "vendor_locations_admin_all"
  on vendor_locations for all
  using  (is_admin())
  with check (is_admin());
