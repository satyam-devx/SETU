-- ═══════════════════════════════════════════════════════════════
-- rider_locations.rider_id unique constraint
--
-- Found while re-auditing every .upsert(..., { onConflict }) call
-- in the app after the vendor_payment_info miss above — same bug,
-- different table:
--
-- useRiderLocation.js upserts GPS pings with
--   { onConflict: 'rider_id' }
-- but rider_id on rider_locations only ever had a plain index, never
-- a unique constraint, so every ping has always failed the same way
-- ("no unique or exclusion constraint matching ON CONFLICT").
--
-- This is also the correct fix, not just a legal one: customers'
-- OrderTrackingMap.jsx subscribes to realtime *UPDATE* events on
-- this table to move the rider's marker — which only ever fires if
-- a rider's ping is genuinely an UPDATE to one existing row, not a
-- fresh INSERT each time. One row per rider, kept current, is the
-- intended design (confirmed by the app's own consumer of this
-- table), not a growing history table.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rider_locations_rider_id_key'
  ) then
    alter table rider_locations add constraint rider_locations_rider_id_key unique (rider_id);
  end if;
exception when others then
  raise notice 'Skipping rider_locations_rider_id_key — existing duplicate rider_id rows must be de-duplicated manually first (keep only the most recent ping per rider): %', sqlerrm;
end $$;
