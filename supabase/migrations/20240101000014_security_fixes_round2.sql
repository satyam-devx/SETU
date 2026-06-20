-- ═══════════════════════════════════════════════════════════════
-- Migration 014: Security Audit Round 2 — Launch Blocker Fixes
--
-- Addresses (see SECURITY_FIXES.md for full writeup):
--   CRITICAL-3  KYC dev-mode bypass + missing schema for verify-aadhaar
--   CRITICAL-4  Sensitive profile columns were self-updatable
--   H1          Anchors could read KYC records for the entire platform
--   H4          No rate limiting on OTP / KYC / AI-assistant endpoints
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Schema fixes so verify-aadhaar actually works ───────────
--
-- verify-aadhaar/index.ts writes profiles.aadhaar_verified and
-- kyc_records.meta / kyc_records.submitted_at, but none of those
-- columns existed in the deployed schema — every write was silently
-- failing (the function ignored the resulting DB error and returned
-- success anyway). Add the missing columns so the feature is real,
-- not just decorative.

alter table profiles
  add column if not exists aadhaar_verified boolean not null default false;

alter table kyc_records
  add column if not exists meta         jsonb,
  add column if not exists submitted_at timestamptz;

-- verify-aadhaar upserts on (user_id, type); needs a real unique
-- constraint for ON CONFLICT to work (previously this would have
-- thrown "there is no unique or exclusion constraint" at runtime).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'kyc_records_user_id_type_key'
  ) then
    alter table kyc_records
      add constraint kyc_records_user_id_type_key unique (user_id, type);
  end if;
exception when others then
  raise notice 'Skipping kyc_records unique constraint — existing duplicate (user_id, type) rows must be de-duplicated manually first: %', sqlerrm;
end $$;

-- ── 2. Lock sensitive profile columns from self-update ─────────
--
-- Migration 013 pinned `role`. It missed is_verified, setu_score,
-- and (the newly-added) aadhaar_verified — a customer could PATCH
-- their own profile row to set is_verified=true, setu_score=999,
-- aadhaar_verified=true and fraudulently unlock SETU Credit / trust
-- features. village_id is left settable ONLY the first time (NULL
-- → a value), which preserves the onboarding flow in
-- RegisterOnboarding.jsx while preventing a verified user from
-- later hopping villages to dodge an anchor/dispute history.

drop policy if exists "profiles_own_update" on profiles;

create policy "profiles_own_update"
  on profiles for update
  using     (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role, id, created_at: immutable via self-update (migration 013)
    and role = (select role from profiles where id = auth.uid())
    -- trust/verification signals: admin- or RPC-controlled only
    and is_verified      = (select is_verified      from profiles where id = auth.uid())
    and setu_score       = (select setu_score       from profiles where id = auth.uid())
    and aadhaar_verified = (select aadhaar_verified from profiles where id = auth.uid())
    -- village_id: settable once (onboarding), then locked
    and (
      village_id = (select village_id from profiles where id = auth.uid())
      or (select village_id from profiles where id = auth.uid()) is null
    )
  );

-- Admins/super_admins still need to be able to change these columns
-- (e.g. manually verifying a user, adjusting setu_score after a
-- dispute). They already write via service_role in the admin
-- backend, which bypasses RLS entirely, so no additional policy is
-- required here — this comment documents that intentionally.

-- ── 3. Anchor KYC reads scoped to their own village ────────────
--
-- kyc_records_anchor_read had no village filter at all: any anchor
-- could read every user's Aadhaar/PAN/GST KYC metadata platform-
-- wide. Scope it to the anchor's own village; admins/super_admins
-- remain unrestricted (they already are platform-wide roles).

drop policy if exists "kyc_records_anchor_read" on kyc_records;

create policy "kyc_records_anchor_read"
  on kyc_records for select using (
    get_my_role() in ('admin', 'super_admin')
    or (
      get_my_role() = 'anchor'
      and exists (
        select 1 from profiles target
        where target.id = kyc_records.user_id
          and target.village_id = get_my_village_id()
      )
    )
  );

-- ── 4. Lightweight Postgres-backed rate limiting ───────────────
--
-- No WAF/edge rate limiting exists in front of Edge Functions (the
-- audit's H4). This won't stop a distributed attacker, but it closes
-- the cheapest abuse path (a single client hammering OTP/KYC/AI
-- endpoints) without requiring new infrastructure. Edge Functions
-- call check_rate_limit() before doing real work.

create table if not exists rate_limit_hits (
  bucket_key  text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_rate_limit_hits_bucket_time
  on rate_limit_hits (bucket_key, occurred_at desc);

-- Auto-prune old rows so this table doesn't grow unbounded.
-- (pg_cron job registered alongside the other cleanup jobs.)
create or replace function prune_rate_limit_hits()
returns void as $$
  delete from rate_limit_hits where occurred_at < now() - interval '1 day';
$$ language sql security definer;

-- check_rate_limit(key, max_count, window_seconds):
--   Records one hit for `key` and returns true if the caller is
--   still within the allowed rate, false if they've exceeded it.
--   security definer so anon/service_role callers can use it
--   without needing direct table grants.
create or replace function check_rate_limit(
  p_key            text,
  p_max_count      integer,
  p_window_seconds integer
) returns boolean as $$
declare
  v_count integer;
begin
  insert into rate_limit_hits (bucket_key) values (p_key);

  select count(*) into v_count
  from rate_limit_hits
  where bucket_key = p_key
    and occurred_at > now() - (p_window_seconds || ' seconds')::interval;

  return v_count <= p_max_count;
end;
$$ language plpgsql security definer;

grant execute on function check_rate_limit(text, integer, integer) to anon, authenticated, service_role;

-- pg_cron already enabled in migration 001; cron.schedule() upserts
-- by job name, so re-running this migration is safe.
select cron.schedule(
  'prune-rate-limit-hits',
  '17 * * * *', -- hourly
  $$ select prune_rate_limit_hits(); $$
);

-- ── 5. Audit log ────────────────────────────────────────────────
insert into audit_log (actor_id, actor, action, target, detail)
values (
  null,
  'system',
  'security_migration',
  'profiles_rls,kyc_records_rls,rate_limiting',
  'migration_014: added aadhaar_verified/kyc meta schema; locked is_verified/setu_score/aadhaar_verified/village_id from self-update; scoped anchor KYC reads to own village; added Postgres-backed rate limiting'
);
