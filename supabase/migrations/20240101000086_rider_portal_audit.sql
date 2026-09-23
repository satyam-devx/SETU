-- ═══════════════════════════════════════════════════════════════
-- Migration 086: Rider portal audit — missing schema
--
-- Four separate gaps found auditing the rider portal end to end:
--
-- 1. riders.preferences — RiderSettings.jsx's four toggles
--    (notifications, order sound, dark mode, offline navigation) were
--    pure local useState with zero persistence anywhere: every one of
--    them silently reset to its default the moment the app restarted.
--    Mirrors vendors.preferences (migration 079) exactly.
--
-- 2. riders.training_completed — RiderProfile.jsx's verification
--    checklist showed "Training" as done whenever rider.rating >= 4.5,
--    which has no real connection to whether onboarding's training
--    videos were ever watched. RiderOnboarding.jsx (this session's
--    earlier fix) now genuinely gates Step 4 on watching all five
--    videos before Next is enabled — this column lets that real fact
--    persist past onboarding instead of only living in transient
--    component state.
--
-- 3. rider_incentives / rider_badges — RiderIncentives.jsx has carried
--    a comment block titled "Database schema required (run once)"
--    with this exact DDL since it was written, and queries both
--    tables directly. Neither table was ever actually created — every
--    load has been silently erroring (data undefined -> ?? []) and
--    falling through to the client-computed placeholder incentives,
--    and the badges section has necessarily shown zero badges ever
--    earned, for every rider, permanently. DDL below is taken
--    verbatim from that comment.
--
-- 4. sos_alerts — RiderSafety.jsx's "Activate SOS" button changed a
--    local boolean and displayed "Help is on the way" — there was no
--    table, no edge function, no admin-visible signal of any kind
--    behind it anywhere in the codebase. Given this is a safety
--    feature, "does nothing but looks like it worked" is the worst
--    possible failure mode. This table is the minimum real backing:
--    an admin-visible, persisted record of every SOS activation, with
--    the rider's last known location if available. Paired with a
--    genuine tel: call to SETU Support triggered at the same time
--    (RiderSafety.jsx), so activating SOS does two real,
--    independently-useful things instead of one fake one.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. riders.preferences ──────────────────────────────────
alter table riders add column if not exists preferences jsonb not null default '{}'::jsonb;
create index if not exists idx_riders_preferences_gin on riders using gin (preferences);

-- ── 2. riders.training_completed ───────────────────────────
alter table riders add column if not exists training_completed boolean not null default false;

-- ── 3. rider_incentives / rider_badges (DDL from RiderIncentives.jsx) ──
create table if not exists rider_incentives (
  id            uuid primary key default gen_random_uuid(),
  rider_id      uuid not null references riders(id) on delete cascade,
  title         text not null,
  description   text,
  type          text not null check (type in ('daily','weekly','monthly','special')),
  target_value  numeric not null,
  current_value numeric not null default 0,
  reward_amount numeric not null,
  status        text not null default 'active'
                  check (status in ('active','completed','expired')),
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_rider_incentives_rider_id on rider_incentives(rider_id);
create index if not exists idx_rider_incentives_status   on rider_incentives(status);

create table if not exists rider_badges (
  id         uuid primary key default gen_random_uuid(),
  rider_id   uuid not null references riders(id) on delete cascade,
  badge_key  text not null,
  earned_at  timestamptz not null default now(),
  unique (rider_id, badge_key)
);
create index if not exists idx_rider_badges_rider_id on rider_badges(rider_id);

alter table rider_incentives enable row level security;
alter table rider_badges     enable row level security;

-- Own-read only (a rider's incentive progress / badges are theirs to
-- see), admin full access. No direct rider write policy — there is no
-- rider-facing UI that writes to either table (RiderIncentives.jsx is
-- read-only), matching the RPC-only convention used elsewhere in this
-- schema for anything a client shouldn't be able to self-grant
-- (nobody should be able to hand themselves a completed incentive or
-- an earned badge by writing the row directly).
create policy "rider_incentives_own_read"
  on rider_incentives for select
  using (rider_id in (select id from riders where user_id = auth.uid()));
create policy "rider_incentives_admin_all"
  on rider_incentives for all
  using (is_admin()) with check (is_admin());

create policy "rider_badges_own_read"
  on rider_badges for select
  using (rider_id in (select id from riders where user_id = auth.uid()));
create policy "rider_badges_admin_all"
  on rider_badges for all
  using (is_admin()) with check (is_admin());

-- ── 4. sos_alerts ───────────────────────────────────────────
create table if not exists sos_alerts (
  id          uuid primary key default gen_random_uuid(),
  rider_id    uuid not null references riders(id) on delete cascade,
  lat         numeric(10,6),
  lng         numeric(10,6),
  status      text not null default 'active' check (status in ('active','cancelled','resolved')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_sos_alerts_rider_id on sos_alerts(rider_id);
create index if not exists idx_sos_alerts_status    on sos_alerts(status);

alter table sos_alerts enable row level security;

-- A rider may create their own alerts and read/cancel their own (the
-- "Cancel SOS" button needs to flip status back), but never resolve
-- one themselves — only an admin marking it handled should do that.
create policy "sos_alerts_own_read"
  on sos_alerts for select
  using (rider_id in (select id from riders where user_id = auth.uid()));
create policy "sos_alerts_own_insert"
  on sos_alerts for insert to authenticated
  with check (rider_id in (select id from riders where user_id = auth.uid()));
create policy "sos_alerts_own_cancel"
  on sos_alerts for update to authenticated
  using (rider_id in (select id from riders where user_id = auth.uid()) and status = 'active')
  with check (status = 'cancelled');
create policy "sos_alerts_admin_all"
  on sos_alerts for all
  using (is_admin()) with check (is_admin());

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'riders,rider_incentives,rider_badges,sos_alerts', 'table',
  'migration_086: rider portal audit — added riders.preferences (Settings toggles had zero persistence), riders.training_completed (real, was faked off rider.rating), rider_incentives/rider_badges (DDL had been documented in RiderIncentives.jsx since it was written but never actually run — every load was silently erroring and falling back to placeholder data), and sos_alerts (the Activate SOS button had no backing of any kind — a local-only boolean claiming "help is on the way").'
);

-- ── 5. Rider can read the customer's phone for an active delivery ──
-- RiderDashboard.jsx and RiderDeliveries.jsx both have "call customer"
-- buttons that read order.customer_phone / order.customerPhone -- a
-- column that has never existed on orders. The customer's real phone
-- lives on profiles, but profiles only ever had two read policies
-- (the owner, and admin) -- no policy let a rider read ANY customer's
-- profile, so even after fixing the app-side query, RLS would still
-- silently return nothing. This grants exactly the narrow,
-- time-limited read a delivery genuinely needs: a rider can read a
-- customer's profile only while an order assigned to them for that
-- customer is still active (not yet delivered or cancelled) -- access
-- disappears the moment the delivery is done.
create policy "profiles_rider_read_active_customer"
  on profiles for select
  using (
    id in (
      select o.customer_id from orders o
      where o.rider_id in (select id from riders where user_id = auth.uid())
        and o.status not in ('delivered', 'cancelled')
    )
  );

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'security_migration', 'profiles', 'table',
  'migration_086: added profiles_rider_read_active_customer RLS policy -- a rider may read a customer''s profile (needed for the "call customer" buttons on RiderDashboard.jsx/RiderDeliveries.jsx, both of which referenced a customer_phone field that has never existed on orders) only while an order assigned to that rider for that customer is still active. No prior policy allowed this at all, so the call buttons were reading undefined regardless of any app-side fix.'
);
