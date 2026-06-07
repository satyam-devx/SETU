// ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — LOCATION INFRASTRUCTURE
-- Migration: 003_locations.sql
-- ═══════════════════════════════════════════════════════════

-- Ensure table from Phase 2 matches expected schema
create table if not exists vendor_locations (
  id               uuid primary key default uuid_generate_v4(),
  vendor_id        uuid not null references vendors(id) on delete cascade,
  lat              numeric(10,6) not null,
  lng              numeric(10,6) not null,
  address          text,
  geom             geography(point) generated always as (st_setsrid(st_makepoint(lng, lat), 4324)) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table vendor_locations enable row level security;
create policy "Public can read vendor locations" on vendor_locations for select using (true);

-- Ensure rider_locations has proper indexes for real-time
create index if not exists idx_rider_locations_composite on rider_locations (rider_id, recorded_at desc);
