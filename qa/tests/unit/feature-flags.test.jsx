// tests/unit/feature-flags.test.jsx
// ─────────────────────────────────────────────────────────────
// Exercises the REAL src/lib/featureFlags.jsx provider. The point of
// this hardening was specifically: a kill switch is only trustworthy
// if a client that can't reach the network keeps respecting the last
// known state instead of quietly reopening the feature. These tests
// assert exactly that contract, plus the localStorage cache that
// makes it survive a cold start.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

let mockIsSupabaseConfigured = true;

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, profile: { role: 'customer' } }),
}));

vi.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsSupabaseConfigured;
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

vi.mock('@/lib/api', () => {
  const my = vi.fn();
  return { FeatureFlagsAPI: { my } };
});

import { FeatureFlagsAPI } from '@/lib/api';
import { FeatureFlagsProvider, useFeatureFlags } from '@/lib/featureFlags';

const CACHE_KEY = 'setu-feature-flags-cache-v1';

function wrapper({ children }) {
  return <FeatureFlagsProvider>{children}</FeatureFlagsProvider>;
}

function ok(rows) {
  return { data: rows, error: null };
}

function networkFailure() {
  return { data: null, error: { message: 'Failed to fetch' } };
}

let activeUnmount = null;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockIsSupabaseConfigured = true;
});

afterEach(() => {
  activeUnmount?.();
  activeUnmount = null;
});

function setup() {
  const rendered = renderHook(() => useFeatureFlags(), { wrapper });
  activeUnmount = rendered.unmount;
  return rendered;
}

describe('FeatureFlagsProvider — normal load', () => {
  it('reflects a disabled flag once the fetch resolves', async () => {
    FeatureFlagsAPI.my.mockResolvedValue(ok([
      { key: 'wallet', enabled: true },
      { key: 'ai', enabled: false },
    ]));

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isEnabled('wallet')).toBe(true);
    expect(result.current.isEnabled('ai')).toBe(false);
    // Never-seen flag is not gated — a missing flag must never hide a
    // feature that exists in the running app.
    expect(result.current.isEnabled('some_future_flag')).toBe(true);
  });

  it('caches the successfully-loaded configuration to localStorage', async () => {
    FeatureFlagsAPI.my.mockResolvedValue(ok([{ key: 'ai', enabled: false }]));

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    expect(cached.known).toContain('ai');
    expect(cached.disabled).toContain('ai');
    expect(typeof cached.fetchedAt).toBe('number');
  });
});

describe('FeatureFlagsProvider — cold start from cache', () => {
  it('hydrates synchronously from the cache before the network call resolves', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ known: ['ai'], disabled: ['ai'], fetchedAt: Date.now() })
    );
    // Fetch never resolves during this test — simulates a slow/offline
    // network. If the provider defaulted "open" while waiting, this
    // would incorrectly report `ai` as enabled.
    FeatureFlagsAPI.my.mockReturnValue(new Promise(() => {}));

    const { result } = setup();

    // No `await` / `waitFor` on the network here — this must be true
    // on the very first render, synchronously from the cache.
    expect(result.current.isEnabled('ai')).toBe(false);
    expect(result.current.isStale).toBe(true);
  });
});

describe('FeatureFlagsProvider — fail-safe on network error', () => {
  it('never wipes a previously-known-good configuration when a refresh fails', async () => {
    FeatureFlagsAPI.my.mockResolvedValueOnce(ok([{ key: 'ai', enabled: false }]));

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isEnabled('ai')).toBe(false);

    // Now a refresh (e.g. triggered by role change / foreground) fails.
    FeatureFlagsAPI.my.mockResolvedValueOnce(networkFailure());
    await act(async () => {
      await result.current.reload();
    });

    // Still respects the last known state — a flaky connection must
    // never quietly reopen a killed feature.
    expect(result.current.isEnabled('ai')).toBe(false);
    expect(result.current.isStale).toBe(true);
  });

  it('falls back to "unknown ⇒ not gated" only on a genuine first-ever load with no cache and no network', async () => {
    FeatureFlagsAPI.my.mockResolvedValue(networkFailure());

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // No cache, no prior successful load this session — nothing safer
    // to fall back to than "not gated", which is the documented
    // behaviour for a flag the client has no information about.
    expect(result.current.isEnabled('ai')).toBe(true);
    expect(result.current.isStale).toBe(true);
  });
});

describe('FeatureFlagsProvider — demo / unconfigured mode', () => {
  it('gates nothing when Supabase is not configured', async () => {
    mockIsSupabaseConfigured = false;

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isEnabled('ai')).toBe(true);
    expect(FeatureFlagsAPI.my).not.toHaveBeenCalled();
  });
});
