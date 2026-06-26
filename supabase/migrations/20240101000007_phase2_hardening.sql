-- ═══════════════════════════════════════════════════════════
-- SETU — Migration 006: Phase 2 Database Hardening
-- For existing databases already running schema.sql v1.
-- Safe to run multiple times (idempotent).
-- ═══════════════════════════════════════════════════════════

-- 1. Extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ─────────────────────────────────────────────────────────
-- 2. profiles.phone — remove NOT NULL
-- ─────────────────────────────────────────────────────────
alter table profiles alter column phone drop not null;

-- ─────────────────────────────────────────────────────────
-- 3. order_number_seq
-- ─────────────────────────────────────────────────────────
create sequence if not exists order_number_seq start 1;

-- Seed the sequence from current max to avoid collisions
-- (runs only if sequence was just created and orders already exist)
do $$
declare v_max bigint;
begin
  select coalesce(max(
    nullif(regexp_replace(order_number, '^SETU-\d{4}-0*', ''), '')::bigint
  ), 0) into v_max from orders;
  if v_max > 0 then
    perform setval('order_number_seq', v_max);
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────
-- 4. kyc_records — add Aadhaar encryption columns
-- ─────────────────────────────────────────────────────────
alter table kyc_records
  add column if not exists aadhaar_encrypted bytea,
  add column if not exists aadhaar_last4     char(4);

-- ─────────────────────────────────────────────────────────
-- 5. payment_events — add to schema (was only in migration 002)
-- ─────────────────────────────────────────────────────────
create table if not exists payment_events (
  id           uuid primary key default uuid_generate_v4(),
  event_id     text unique not null,
  type         text not null,
  payload      jsonb not null,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_payment_events_event_id     on payment_events(event_id);
create index if not exists idx_payment_events_processed_at on payment_events(processed_at) where processed_at is null;
create index if not exists idx_payment_events_created_at   on payment_events(created_at desc);

alter table payment_events enable row level security;
-- Admins read; service_role writes via webhook Edge Function
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'payment_events' and policyname = 'payment_events_admin_read'
  ) then
    create policy "payment_events_admin_read"
      on payment_events for select
      using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','super_admin')));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────
-- 6. Add missing tables: disputes, escalations, noticeboard
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

drop trigger if exists trg_disputes_updated_at on disputes;
create trigger trg_disputes_updated_at
  before update on disputes
  for each row execute function update_updated_at();

alter table disputes enable row level security;

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

drop trigger if exists trg_escalations_updated_at on escalations;
create trigger trg_escalations_updated_at
  before update on escalations
  for each row execute function update_updated_at();

alter table escalations enable row level security;

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

drop trigger if exists trg_noticeboard_updated_at on noticeboard;
create trigger trg_noticeboard_updated_at
  before update on noticeboard
  for each row execute function update_updated_at();

alter table noticeboard enable row level security;

-- ─────────────────────────────────────────────────────────
-- 7. Fix RLS: drop overly-permissive FOR ALL policies and
--    replace with split USING + WITH CHECK versions.
-- ─────────────────────────────────────────────────────────

-- vendors
drop policy if exists "vendors_own_write" on vendors;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='vendors' and policyname='vendors_own_insert') then
    create policy "vendors_own_insert" on vendors for insert with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='vendors' and policyname='vendors_own_update') then
    create policy "vendors_own_update" on vendors for update
      using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='vendors' and policyname='vendors_own_delete') then
    create policy "vendors_own_delete" on vendors for delete using (owner_id = auth.uid());
  end if;
end $$;

-- products
drop policy if exists "products_own_write" on products;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='products' and policyname='products_own_insert') then
    create policy "products_own_insert" on products for insert with check (
      vendor_id in (select id from vendors where owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='products' and policyname='products_own_update') then
    create policy "products_own_update" on products for update
      using     (vendor_id in (select id from vendors where owner_id = auth.uid()))
      with check (vendor_id in (select id from vendors where owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='products' and policyname='products_own_delete') then
    create policy "products_own_delete" on products for delete using (
      vendor_id in (select id from vendors where owner_id = auth.uid())
    );
  end if;
end $$;

-- riders
drop policy if exists "riders_own_write" on riders;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='riders' and policyname='riders_own_insert') then
    create policy "riders_own_insert" on riders for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='riders' and policyname='riders_own_update') then
    create policy "riders_own_update" on riders for update
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- seva_providers
drop policy if exists "seva_providers_own_write" on seva_providers;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='seva_providers' and policyname='seva_providers_own_insert') then
    create policy "seva_providers_own_insert" on seva_providers for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='seva_providers' and policyname='seva_providers_own_update') then
    create policy "seva_providers_own_update" on seva_providers for update
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- 8. Fix audit_log: drop the open "with check (true)" INSERT policy
drop policy if exists "audit_log_system_insert" on audit_log;
-- No replacement INSERT policy; security-definer functions bypass RLS.

-- ─────────────────────────────────────────────────────────
-- 9. Add rider_locations composite index (if not exists)
-- ─────────────────────────────────────────────────────────
create index if not exists idx_rider_locations_composite
  on rider_locations(rider_id, recorded_at desc);

-- ─────────────────────────────────────────────────────────
-- 10. Enable Realtime on new tables
--     Idempotent: disputes/noticeboard may already be members of the
--     publication (added in 000001), so re-adding raises 42710
--     (duplicate_object). Swallow it so a fresh `supabase start` and a
--     re-run both succeed.
-- ─────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table disputes;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table noticeboard;
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────
-- 11. pg_cron: rider_locations cleanup job
-- ─────────────────────────────────────────────────────────
-- Delete any existing job with this name first (idempotent)
select cron.unschedule('prune-rider-locations') where exists (
  select 1 from cron.job where jobname = 'prune-rider-locations'
);
select cron.schedule(
  'prune-rider-locations',
  '0 * * * *',
  $$
    delete from public.rider_locations
    where recorded_at < now() - interval '48 hours';
  $$
);
