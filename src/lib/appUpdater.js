// ═══════════════════════════════════════════════════════════
// SETU — appUpdater
//
// Native-app-only OTA update lifecycle, backed by our own
// Supabase Storage + the `app_updates` table (migrations 062,
// 063) — no third-party update service involved.
//
// The core guarantee: a bad OTA bundle must never permanently
// brick the app or trap a device on a broken version. That's
// enforced in layers:
//
//   1. Native (the plugin itself) — CapacitorUpdater rolls back
//      automatically if `notifyAppReady()` is never called within
//      `appReadyTimeout` (capacitor.config.json). This alone
//      covers "the new bundle's JS never even finished loading".
//   2. Us, right after activating a new bundle — confirmHealthyBoot()
//      runs a short post-boot health check *before* confirming
//      readiness to the plugin. Fail it, and we explicitly roll
//      back to the exact bundle that was running before (captured
//      at download time, not guessed), then permanently blocklist
//      the bad version on this device.
//   3. Us, on every foreground — checkForRevocation() rolls a
//      device off a version the server has since marked `revoked`,
//      even if it looked healthy at the time.
//   4. Ultimate floor — if the known-good bundle is itself gone or
//      also fails, CapacitorUpdater.reset() drops back to the
//      bundle shipped inside the APK, which by definition always
//      exists and was never touched by any OTA.
//
// On the web build (Cloudflare/GitHub Pages) every exported
// function here is a safe no-op — `Capacitor.isNativePlatform()`
// is false there, so none of the native plugin code ever runs.
//
// This file only ever touches JS/CSS/HTML bundles. It has nothing
// to do with, and never triggers, an APK-level rollback — that's
// a separate, native-shell concern (see .github/workflows/
// build-android.yml and ANDROID_APP.md).
// ═══════════════════════════════════════════════════════════
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

const PLATFORM = Capacitor.getPlatform?.() === 'ios' ? 'ios' : 'android';

const STATE_KEY = 'setu-ota-state-v1';
const MAX_DOWNLOAD_ATTEMPTS = 3;   // transient network/checksum failures before giving up on a version
const MAX_BLOCKLIST_ENTRIES = 20;  // keep localStorage bounded over the life of the install
const HEALTH_CHECK_GRACE_MS = 4000; // must stay comfortably under capacitor.config.json's appReadyTimeout

// ── Local, per-device state ──────────────────────────────────
// Survives restarts (localStorage), never sent anywhere. Tracks:
//   pendingVersion/pendingBundleId  — an OTA bundle just activated,
//                                     awaiting its post-boot health check
//   knownGoodVersion/knownGoodBundleId — the last bundle that passed
//                                     its health check; the rollback target
//   blockedVersions   — versions this device must never (re)activate
//   downloadAttempts  — soft retry counter per version, resets on success

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeState(patch) {
  const next = { ...readState(), ...patch };
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {
    // Storage full/unavailable — degrade gracefully rather than throw;
    // worst case we lose the rollback breadcrumb for this one update.
  }
  return next;
}

function isBlocked(version) {
  const { blockedVersions } = readState();
  return !!blockedVersions?.[version];
}

function blockVersion(version, reason) {
  const state = readState();
  const blockedVersions = { ...(state.blockedVersions || {}) };
  blockedVersions[version] = { reason: String(reason).slice(0, 200), at: Date.now() };

  // Bound the map so a long-lived install with many bad releases over
  // time doesn't grow this forever — drop the oldest entries.
  const entries = Object.entries(blockedVersions).sort((a, b) => a[1].at - b[1].at);
  const trimmed = Object.fromEntries(entries.slice(-MAX_BLOCKLIST_ENTRIES));

  writeState({ blockedVersions: trimmed });
}

function recordDownloadAttempt(version) {
  const state = readState();
  const downloadAttempts = { ...(state.downloadAttempts || {}) };
  downloadAttempts[version] = (downloadAttempts[version] || 0) + 1;
  writeState({ downloadAttempts });
  return downloadAttempts[version];
}

function clearDownloadAttempts(version) {
  const state = readState();
  const downloadAttempts = { ...(state.downloadAttempts || {}) };
  delete downloadAttempts[version];
  writeState({ downloadAttempts });
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// Ultimate safety net — always available, ships inside the APK itself,
// never touched by any OTA. Used when there's no known-good bundle to
// return to, or returning to it also fails.
async function resetToBuiltin(CapacitorUpdater) {
  try {
    await CapacitorUpdater.reset();
  } catch (err) {
    console.error('[appUpdater] reset to builtin bundle failed:', err?.message);
  }
}

async function rollbackToKnownGood(state) {
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  if (state.knownGoodBundleId) {
    try {
      await CapacitorUpdater.set({ id: state.knownGoodBundleId });
      return;
    } catch (err) {
      console.warn('[appUpdater] rollback to known-good bundle failed, resetting to builtin:', err?.message);
    }
  }
  await resetToBuiltin(CapacitorUpdater);
}

// ── Public API ────────────────────────────────────────────────

// Returns { version, bundleUrl, notes, checksum } if a newer,
// non-revoked, non-blocklisted bundle is published, else null.
export async function checkForUpdate() {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const { bundle: current } = await CapacitorUpdater.current();
    const currentVersion = current?.version ?? null;

    const { data, error } = await supabase
      .from('app_updates')
      .select('version, bundle_url, notes, checksum')
      .eq('platform', PLATFORM)
      .eq('is_active', true)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    if (data.version === currentVersion) return null;
    if (isBlocked(data.version)) return null; // already failed on this device — don't re-offer

    return { version: data.version, bundleUrl: data.bundle_url, notes: data.notes, checksum: data.checksum };
  } catch (err) {
    // Covers offline / DNS / Supabase-unreachable — treated as "nothing
    // to offer right now", never as a failure of any bundle.
    console.warn('[appUpdater] checkForUpdate failed:', err?.message);
    return null;
  }
}

// Downloads (with native checksum verification) and activates a new
// bundle. Captures the currently-running bundle as the explicit
// rollback target *before* switching, so confirmHealthyBoot() has a
// deterministic way back if the new one turns out to be broken.
export async function applyUpdate({ version, bundleUrl, checksum }) {
  if (!Capacitor.isNativePlatform()) return;

  if (isBlocked(version)) {
    throw new Error('This version was previously blocked on this device and will not be retried.');
  }

  const attempts = recordDownloadAttempt(version);
  if (attempts > MAX_DOWNLOAD_ATTEMPTS) {
    blockVersion(version, 'exceeded max download attempts');
    throw new Error('Too many failed download attempts for this version — it has been blocked.');
  }

  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  const { bundle: previous } = await CapacitorUpdater.current();

  // Interrupted downloads, corrupted zips, and checksum mismatches all
  // surface here as a rejected promise — a soft failure. We deliberately
  // do NOT blocklist on this path (a flaky connection isn't evidence the
  // bundle itself is bad); the attempt counter above is what eventually
  // gives up on a version that can never seem to download cleanly.
  const downloaded = await CapacitorUpdater.download({ url: bundleUrl, version, checksum });

  writeState({
    pendingVersion: version,
    pendingBundleId: downloaded.id,
    knownGoodBundleId: previous?.id ?? null,
    knownGoodVersion: previous?.version ?? null,
  });
  clearDownloadAttempts(version);

  await CapacitorUpdater.set({ id: downloaded.id }); // terminal — reloads the webview on the new bundle
}

// Call once, early, on every native launch (App.jsx). Fast path for a
// normal boot on an already-confirmed bundle; a stricter, time-boxed
// health check only kicks in right after a fresh OTA activation — this
// system is about safe *updates*, not general in-app crash monitoring.
export async function confirmHealthyBoot(runHealthChecks) {
  if (!Capacitor.isNativePlatform()) return;

  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  const state = readState();

  if (!state.pendingVersion) {
    // Normal boot on an already-trusted bundle — confirm promptly.
    try {
      await CapacitorUpdater.notifyAppReady();
    } catch (err) {
      console.warn('[appUpdater] notifyAppReady failed:', err?.message);
    }
    return;
  }

  // We just activated a new OTA bundle for the first time this launch —
  // give it a short, bounded window to prove itself before confirming.
  try {
    const healthy = await withTimeout(
      runHealthChecks ? runHealthChecks() : defaultHealthCheck(),
      HEALTH_CHECK_GRACE_MS,
      'health check timed out'
    );
    if (!healthy) throw new Error('health check reported unhealthy');

    await CapacitorUpdater.notifyAppReady();
    writeState({
      pendingVersion: null,
      pendingBundleId: null,
      knownGoodVersion: state.pendingVersion,
      knownGoodBundleId: state.pendingBundleId,
    });
  } catch (err) {
    console.warn('[appUpdater] post-update health check failed, rolling back:', err?.message);
    blockVersion(state.pendingVersion, err?.message || 'startup health check failed');
    writeState({ pendingVersion: null, pendingBundleId: null });
    await rollbackToKnownGood(state);
    // Deliberately do NOT call notifyAppReady on the failed bundle — if
    // rollbackToKnownGood itself somehow didn't reload in time, the
    // plugin's own appReadyTimeout is still there as a backstop.
  }
}

// Default health check when the caller doesn't supply one: did any
// uncaught error or unhandled rejection fire in the brief window right
// after boot? This intentionally does NOT make a network call — an
// offline device is not evidence of a bad bundle, and treating it as
// such would blocklist perfectly good releases whenever connectivity is
// flaky (see requirement to handle offline conditions safely).
function defaultHealthCheck() {
  return new Promise((resolve) => {
    let failed = false;
    const onError = () => {
      failed = true;
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onError);

    setTimeout(() => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onError);
      resolve(!failed);
    }, HEALTH_CHECK_GRACE_MS - 250); // resolve just inside the outer timeout
  });
}

// Foreground / periodic check: rolls a device off a version that's been
// revoked server-side since it was activated, even though it passed its
// own health check at the time.
export async function checkForRevocation() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const { bundle: current } = await CapacitorUpdater.current();
    if (!current?.version) return; // running the builtin bundle — nothing to revoke

    const { data, error } = await supabase
      .from('app_updates')
      .select('revoked')
      .eq('platform', PLATFORM)
      .eq('version', current.version)
      .maybeSingle();

    if (error || !data?.revoked) return;

    blockVersion(current.version, 'revoked remotely');
    await rollbackToKnownGood(readState());
  } catch (err) {
    console.warn('[appUpdater] checkForRevocation failed:', err?.message);
  }
}
