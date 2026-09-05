-- ═══════════════════════════════════════════════════════════
-- SETU — app_updates hardening
-- Adds what the OTA rollback/failsafe system needs on top of
-- migration 062:
--   • checksum — sha256 of the bundle zip, passed to
--     CapacitorUpdater.download() so the plugin verifies bundle
--     integrity natively before it's ever activated.
--   • revoked  — an independent kill-switch per row. is_active
--     means "newest release, offer this to new activations";
--     revoked means "never activate this version again, and if
--     a device is currently running it, roll back" — the two are
--     deliberately separate so an old, already-superseded row can
--     still be marked revoked (e.g. discovered bad after the
--     fact) without disturbing what's currently active.
-- ═══════════════════════════════════════════════════════════

alter table public.app_updates
  add column if not exists checksum   text,
  add column if not exists revoked    boolean not null default false,
  add column if not exists revoked_at timestamptz;

-- The client's "is there anything newer, active, and not revoked"
-- query filters on all three columns together — keep it one index.
drop index if exists public.app_updates_active_idx;
create index if not exists app_updates_active_idx
  on public.app_updates (platform, is_active, revoked, created_at desc);

-- The client also looks up its own currently-running version to check
-- for revocation (see checkForRevocation in src/lib/appUpdater.js).
create index if not exists app_updates_platform_version_idx
  on public.app_updates (platform, version);
