// tests/unit/app-updater.test.js
// ─────────────────────────────────────────────────────────────
// Exercises the REAL src/lib/appUpdater.js OTA rollback/failsafe
// lifecycle (not re-implemented logic). Covers: successful update,
// failed update, corrupted bundle, interrupted download, startup
// health-check failure + automatic rollback, update-loop
// prevention, and a remotely revoked release rolling a device back.
//
// @capacitor/core, @capgo/capacitor-updater, and @/lib/supabase are
// all mocked — this tests appUpdater's own decision logic (what it
// does with the plugin/network, and in what order), not the native
// plugin or a real database.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @capacitor/core BEFORE importing appUpdater.
vi.mock('@capacitor/core', () => {
  const isNativePlatform = vi.fn(() => true);
  const getPlatform = vi.fn(() => 'android');
  return { Capacitor: { isNativePlatform, getPlatform } };
});

// Mock the native OTA plugin — appUpdater imports it dynamically
// (`await import(...)`), which vi.mock intercepts the same as a
// static import.
vi.mock('@capgo/capacitor-updater', () => {
  const current = vi.fn();
  const download = vi.fn();
  const set = vi.fn();
  const reset = vi.fn();
  const notifyAppReady = vi.fn();
  return { CapacitorUpdater: { current, download, set, reset, notifyAppReady } };
});

// Mock the supabase module BEFORE importing appUpdater.
vi.mock('@/lib/supabase', () => {
  const from = vi.fn();
  return { supabase: { from } };
});

import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { supabase } from '@/lib/supabase';
import { checkForUpdate, applyUpdate, confirmHealthyBoot, checkForRevocation } from '@/lib/appUpdater';

// A chainable stand-in for the real `.from().select().eq()...` query
// builder — every method returns the same chain object so it works
// regardless of how many .eq()/.order()/.limit() calls a given
// appUpdater function makes, with `maybeSingle()` resolving to
// whatever this test wants the "query result" to be.
function makeSupabaseChain(result) {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  return chain;
}

const LATEST_ROW = {
  version: 'v2',
  bundle_url: 'https://storage.example/app-updates/android/v2.zip',
  notes: 'fixed the coupon bug',
  checksum: 'abc123',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Capacitor.isNativePlatform.mockReturnValue(true);
  CapacitorUpdater.current.mockResolvedValue({ bundle: { id: 'bundle-v1', version: 'v1' } });
});

// ═══════════════════════════════════════════════════════════════
// Web / non-native guard — every export must be a safe no-op
// ═══════════════════════════════════════════════════════════════
describe('non-native platform (web build)', () => {
  beforeEach(() => {
    Capacitor.isNativePlatform.mockReturnValue(false);
  });

  it('checkForUpdate returns null without touching the plugin or network', async () => {
    const result = await checkForUpdate();
    expect(result).toBeNull();
    expect(CapacitorUpdater.current).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('applyUpdate, confirmHealthyBoot, checkForRevocation all resolve without calling the plugin', async () => {
    await expect(applyUpdate({ version: 'v2', bundleUrl: 'x' })).resolves.toBeUndefined();
    await expect(confirmHealthyBoot()).resolves.toBeUndefined();
    await expect(checkForRevocation()).resolves.toBeUndefined();
    expect(CapacitorUpdater.download).not.toHaveBeenCalled();
    expect(CapacitorUpdater.set).not.toHaveBeenCalled();
    expect(CapacitorUpdater.notifyAppReady).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// checkForUpdate
// ═══════════════════════════════════════════════════════════════
describe('checkForUpdate', () => {
  it('offers a newer, active, non-revoked release', async () => {
    supabase.from.mockReturnValue(makeSupabaseChain({ data: LATEST_ROW, error: null }));

    const result = await checkForUpdate();

    expect(result).toEqual({
      version: 'v2',
      bundleUrl: LATEST_ROW.bundle_url,
      notes: LATEST_ROW.notes,
      checksum: LATEST_ROW.checksum,
    });
  });

  it('returns null when already running the latest version', async () => {
    CapacitorUpdater.current.mockResolvedValue({ bundle: { id: 'bundle-v2', version: 'v2' } });
    supabase.from.mockReturnValue(makeSupabaseChain({ data: LATEST_ROW, error: null }));

    expect(await checkForUpdate()).toBeNull();
  });

  it('returns null (never throws) when the network/query fails — offline handling', async () => {
    supabase.from.mockImplementation(() => {
      throw new Error('Failed to fetch');
    });

    await expect(checkForUpdate()).resolves.toBeNull();
  });

  it('returns null when there is no active release row', async () => {
    supabase.from.mockReturnValue(makeSupabaseChain({ data: null, error: null }));
    expect(await checkForUpdate()).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// applyUpdate — successful update
// ═══════════════════════════════════════════════════════════════
describe('applyUpdate — success path', () => {
  it('downloads, records rollback breadcrumbs, then activates the new bundle', async () => {
    CapacitorUpdater.download.mockResolvedValue({ id: 'bundle-v2', version: 'v2' });
    CapacitorUpdater.set.mockResolvedValue(undefined);

    await applyUpdate({ version: 'v2', bundleUrl: LATEST_ROW.bundle_url, checksum: 'abc123' });

    // Checksum passed straight through so the plugin verifies bundle
    // integrity natively before it's ever considered "downloaded".
    expect(CapacitorUpdater.download).toHaveBeenCalledWith({
      url: LATEST_ROW.bundle_url,
      version: 'v2',
      checksum: 'abc123',
    });
    // The bundle running *before* the switch is captured as the
    // explicit rollback target — not guessed at rollback time.
    const state = JSON.parse(localStorage.getItem('setu-ota-state-v1'));
    expect(state.knownGoodBundleId).toBe('bundle-v1');
    expect(state.knownGoodVersion).toBe('v1');
    expect(state.pendingVersion).toBe('v2');
    expect(state.pendingBundleId).toBe('bundle-v2');

    expect(CapacitorUpdater.set).toHaveBeenCalledWith({ id: 'bundle-v2' });
  });
});

// ═══════════════════════════════════════════════════════════════
// applyUpdate — failed / interrupted / corrupted download
// ═══════════════════════════════════════════════════════════════
describe('applyUpdate — failed, interrupted, and corrupted downloads', () => {
  it('propagates a download failure without ever activating or recording it as pending', async () => {
    CapacitorUpdater.download.mockRejectedValue(new Error('network interrupted'));

    await expect(applyUpdate({ version: 'v2', bundleUrl: 'x' })).rejects.toThrow('network interrupted');

    expect(CapacitorUpdater.set).not.toHaveBeenCalled();
    const state = JSON.parse(localStorage.getItem('setu-ota-state-v1') || '{}');
    expect(state.pendingVersion).toBeUndefined();
  });

  it('propagates a checksum-mismatch (corrupted bundle) failure the same safe way', async () => {
    CapacitorUpdater.download.mockRejectedValue(new Error('checksum mismatch'));

    await expect(
      applyUpdate({ version: 'v2', bundleUrl: 'x', checksum: 'deadbeef' })
    ).rejects.toThrow('checksum mismatch');

    expect(CapacitorUpdater.set).not.toHaveBeenCalled();
  });

  it('blocks a version after repeated download failures and stops offering/allowing it (loop prevention)', async () => {
    CapacitorUpdater.download.mockRejectedValue(new Error('network interrupted'));

    // Attempts 1–3 fail "normally" (transient-failure path).
    await expect(applyUpdate({ version: 'v2', bundleUrl: 'x' })).rejects.toThrow('network interrupted');
    await expect(applyUpdate({ version: 'v2', bundleUrl: 'x' })).rejects.toThrow('network interrupted');
    await expect(applyUpdate({ version: 'v2', bundleUrl: 'x' })).rejects.toThrow('network interrupted');

    // 4th attempt: the version is now blocked outright — no further
    // download is even attempted.
    CapacitorUpdater.download.mockClear();
    await expect(applyUpdate({ version: 'v2', bundleUrl: 'x' })).rejects.toThrow(/blocked/i);
    expect(CapacitorUpdater.download).not.toHaveBeenCalled();

    // And it will never be offered again either.
    supabase.from.mockReturnValue(makeSupabaseChain({ data: LATEST_ROW, error: null }));
    expect(await checkForUpdate()).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// confirmHealthyBoot — normal boot fast path
// ═══════════════════════════════════════════════════════════════
describe('confirmHealthyBoot — normal boot (no pending update)', () => {
  it('confirms readiness immediately without running a health check', async () => {
    const healthCheck = vi.fn();

    await confirmHealthyBoot(healthCheck);

    expect(healthCheck).not.toHaveBeenCalled();
    expect(CapacitorUpdater.notifyAppReady).toHaveBeenCalledTimes(1);
    expect(CapacitorUpdater.set).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// confirmHealthyBoot — startup failure → automatic rollback
// ═══════════════════════════════════════════════════════════════
describe('confirmHealthyBoot — startup failure after a fresh OTA activation', () => {
  function seedPendingUpdate() {
    localStorage.setItem(
      'setu-ota-state-v1',
      JSON.stringify({
        pendingVersion: 'v2',
        pendingBundleId: 'bundle-v2',
        knownGoodVersion: 'v1',
        knownGoodBundleId: 'bundle-v1',
      })
    );
  }

  it('rolls back to the known-good bundle when the health check fails, and never confirms the bad one', async () => {
    seedPendingUpdate();
    const failingHealthCheck = vi.fn().mockResolvedValue(false);

    await confirmHealthyBoot(failingHealthCheck);

    expect(CapacitorUpdater.set).toHaveBeenCalledWith({ id: 'bundle-v1' });
    expect(CapacitorUpdater.notifyAppReady).not.toHaveBeenCalled();

    const state = JSON.parse(localStorage.getItem('setu-ota-state-v1'));
    expect(state.pendingVersion).toBeNull();

    // The failed version must never be offered or re-attempted again.
    supabase.from.mockReturnValue(
      makeSupabaseChain({ data: { ...LATEST_ROW, version: 'v2' }, error: null })
    );
    expect(await checkForUpdate()).toBeNull();
    await expect(applyUpdate({ version: 'v2', bundleUrl: 'x' })).rejects.toThrow(/blocked/i);
  });

  it('rolls back the same way when the health check throws instead of resolving false', async () => {
    seedPendingUpdate();
    const throwingHealthCheck = vi.fn().mockRejectedValue(new Error('critical init error'));

    await confirmHealthyBoot(throwingHealthCheck);

    expect(CapacitorUpdater.set).toHaveBeenCalledWith({ id: 'bundle-v1' });
    expect(CapacitorUpdater.notifyAppReady).not.toHaveBeenCalled();
  });

  it('falls back to resetting the builtin bundle when there is no known-good bundle to return to', async () => {
    localStorage.setItem(
      'setu-ota-state-v1',
      JSON.stringify({ pendingVersion: 'v2', pendingBundleId: 'bundle-v2', knownGoodBundleId: null })
    );
    const failingHealthCheck = vi.fn().mockResolvedValue(false);

    await confirmHealthyBoot(failingHealthCheck);

    expect(CapacitorUpdater.set).not.toHaveBeenCalled();
    expect(CapacitorUpdater.reset).toHaveBeenCalledTimes(1);
  });

  it('falls back to resetting the builtin bundle when set() on the known-good bundle itself fails', async () => {
    seedPendingUpdate();
    CapacitorUpdater.set.mockRejectedValue(new Error('bundle no longer on device'));
    const failingHealthCheck = vi.fn().mockResolvedValue(false);

    await confirmHealthyBoot(failingHealthCheck);

    expect(CapacitorUpdater.set).toHaveBeenCalledWith({ id: 'bundle-v1' });
    expect(CapacitorUpdater.reset).toHaveBeenCalledTimes(1);
  });

  it('promotes the pending version to known-good when the health check passes', async () => {
    seedPendingUpdate();
    const passingHealthCheck = vi.fn().mockResolvedValue(true);

    await confirmHealthyBoot(passingHealthCheck);

    expect(CapacitorUpdater.notifyAppReady).toHaveBeenCalledTimes(1);
    expect(CapacitorUpdater.set).not.toHaveBeenCalled();

    const state = JSON.parse(localStorage.getItem('setu-ota-state-v1'));
    expect(state.pendingVersion).toBeNull();
    expect(state.knownGoodVersion).toBe('v2');
    expect(state.knownGoodBundleId).toBe('bundle-v2');
  });
});

// ═══════════════════════════════════════════════════════════════
// checkForRevocation — remotely revoked release
// ═══════════════════════════════════════════════════════════════
describe('checkForRevocation', () => {
  it('rolls back a device currently running a version that was revoked server-side', async () => {
    localStorage.setItem(
      'setu-ota-state-v1',
      JSON.stringify({ knownGoodVersion: 'v1', knownGoodBundleId: 'bundle-v1' })
    );
    CapacitorUpdater.current.mockResolvedValue({ bundle: { id: 'bundle-v2', version: 'v2' } });
    supabase.from.mockReturnValue(makeSupabaseChain({ data: { revoked: true }, error: null }));

    await checkForRevocation();

    expect(CapacitorUpdater.set).toHaveBeenCalledWith({ id: 'bundle-v1' });

    // A revoked version must be blocked exactly like a failed one —
    // it can never be re-activated on this device.
    await expect(applyUpdate({ version: 'v2', bundleUrl: 'x' })).rejects.toThrow(/blocked/i);
  });

  it('does nothing when the running version is not revoked', async () => {
    supabase.from.mockReturnValue(makeSupabaseChain({ data: { revoked: false }, error: null }));

    await checkForRevocation();

    expect(CapacitorUpdater.set).not.toHaveBeenCalled();
    expect(CapacitorUpdater.reset).not.toHaveBeenCalled();
  });

  it('does nothing when running the builtin bundle (no OTA version at all)', async () => {
    CapacitorUpdater.current.mockResolvedValue({ bundle: { id: null, version: null } });

    await checkForRevocation();

    expect(supabase.from).not.toHaveBeenCalled();
    expect(CapacitorUpdater.set).not.toHaveBeenCalled();
  });

  it('fails safe (no rollback) when the revocation check itself cannot reach the network', async () => {
    supabase.from.mockImplementation(() => {
      throw new Error('offline');
    });

    await expect(checkForRevocation()).resolves.toBeUndefined();
    expect(CapacitorUpdater.set).not.toHaveBeenCalled();
    expect(CapacitorUpdater.reset).not.toHaveBeenCalled();
  });
});
