-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — LOCATIONS & MAPS
-- Phase 4: Geo-spatial schema
-- ═══════════════════════════════════════════════════════════

-- Enable PostGIS if available (Supabase supports this)
-- create extension if not exists postgis;

-- ─────────────────────────────────────────────────────────
-- VENDOR LOCATIONS (Extended)
-- ─────────────────────────────────────────────────────────
-- Already partially in schema.sql, adding more if needed
alter table vendors add column if not exists address text;
alter table vendors add column if not exists city text default 'Madhepur';

-- ─────────────────────────────────────────────────────────
-- RIDER TRACKING HISTORY
-- ─────────────────────────────────────────────────────────
-- rider_locations already exists in schema.sql, we'll refine it here
-- if we need a history table for heatmaps or audits.

create table if not exists rider_location_history (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references riders(id) on delete cascade,
  lat          numeric(10,6) not null,
  lng          numeric(10,6) not null,
  recorded_at  timestamptz not null default now()
);
create index if not exists idx_rider_history_rider_id on rider_location_history(rider_id);
create index if not exists idx_rider_history_recorded_at on rider_location_history(recorded_at desc);

-- ─────────────────────────────────────────────────────────
-- VILLAGE BOUNDARIES (GeoJSON storage)
-- ─────────────────────────────────────────────────────────
alter table villages add column if not exists boundary jsonb;

-- ─────────────────────────────────────────────────────────
-- RLS FOR LOCATIONS
-- ─────────────────────────────────────────────────────────
alter table rider_location_history enable row level security;

-- Admin can read history
create policy "rider_history_admin" on rider_location_history
  for select using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','super_admin')));

-- Riders can insert their own history
create policy "rider_history_own_insert" on rider_location_history
  for insert with check (rider_id in (select id from riders where user_id = auth.uid()));
