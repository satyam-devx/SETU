-- ═══════════════════════════════════════════════════════════
-- SETU — app_updates
-- Backs the in-app (Capacitor) OTA updater. Each row is one
-- published web-bundle release; the app polls for the newest
-- `is_active` row whose `platform` matches and compares
-- `version` against the bundle it's currently running.
--
-- Publishing a new release is `npm run release:ota` (see
-- scripts/release-ota.mjs) — it zips `dist/`, uploads it to the
-- `app-updates` storage bucket, and inserts one row here.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.app_updates (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null default 'android' check (platform in ('android', 'ios')),
  version      text not null,                -- matches the "version" field passed to CapacitorUpdater.download()
  bundle_url   text not null,                -- public URL of the dist.zip in Supabase Storage
  notes        text,                         -- optional changelog shown in the in-app update banner
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists app_updates_active_idx
  on public.app_updates (platform, is_active, created_at desc);

alter table public.app_updates enable row level security;

-- Anyone (including anonymous/pre-login app boot) can read which
-- bundle is currently active — this is a public release manifest,
-- not sensitive data, and the app needs to check it before a user
-- has necessarily signed in.
create policy "app_updates_public_read"
  on public.app_updates for select
  using (true);

-- Only service-role (the release script, via the service key) can
-- publish new rows — never exposed to the client anon key.
create policy "app_updates_service_write"
  on public.app_updates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── Storage bucket for the published dist.zip bundles ──────────
-- Public read (the app downloads the zip pre-login, same as the
-- manifest above) — but only service_role (release script) can
-- write, so a compromised anon/user key can never plant a bundle.
insert into storage.buckets (id, name, public) values
  ('app-updates', 'app-updates', true)
on conflict (id) do nothing;

drop policy if exists "app_updates_bucket_read"   on storage.objects;
drop policy if exists "app_updates_bucket_write"  on storage.objects;

create policy "app_updates_bucket_read" on storage.objects for select
  using (bucket_id = 'app-updates');

create policy "app_updates_bucket_write" on storage.objects for all
  using (bucket_id = 'app-updates' and auth.role() = 'service_role')
  with check (bucket_id = 'app-updates' and auth.role() = 'service_role');
