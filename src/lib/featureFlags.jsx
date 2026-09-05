// ═══════════════════════════════════════════════════════════
// SETU — Feature Flags (client)
//
// Loads the caller's server-evaluated flag set (my_feature_flags,
// migration 022) and exposes useFeatureFlag(key) / <Feature>.
// Evaluation (enable/rollout/audience) is done server-side, so the
// client only stores the result. Unknown flags default to ON (not
// gated), so a missing flag never hides an existing feature.
//
// This gates UI only; backend RPCs/Edge Functions gate themselves via
// is_feature_enabled() — the client is never the security boundary.
//
// ── Safe-default / offline behaviour (the part that actually matters
//    for a kill switch to be trustworthy) ──────────────────────────
// A kill switch is only real if a client that can't reach the network
// still respects the *last known* state instead of quietly reopening
// the feature. So:
//   1. The last successfully-loaded flag set is cached in localStorage
//      and hydrated synchronously on mount — before the first network
//      call even resolves — so a cold start never has a "wide open"
//      window while waiting for a response.
//   2. A failed refresh NEVER clears or overwrites the current
//      known-good state. Worst case on a flaky connection is serving
//      slightly stale (but real) flags, never "we lost the config so
//      let's assume everything's on".
//   3. Only a genuine first-ever launch with no cache and no network
//      falls through to "unknown ⇒ not gated" — there's no other
//      information available at that point, and that default has
//      always been the documented behaviour for unrecognised flags.
//   4. Refreshes are triggered on foreground (native + web) and on a
//      periodic interval while the app is open, so an emergency
//      kill switch propagates within minutes, not just "next cold
//      start".
// ═══════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { isSupabaseConfigured } from './supabase';
import { FeatureFlagsAPI } from './api';
import { useAuth } from './AuthContext';

const CACHE_KEY = 'setu-feature-flags-cache-v1';
const REFRESH_INTERVAL_MS = 2 * 60 * 1000; // periodic re-check while the app is open

const FeatureFlagsContext = createContext({
  isEnabled: () => true,
  loading: true,
  isStale: false,
  lastUpdated: null,
  reload: () => {},
});

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!raw || !Array.isArray(raw.known) || !Array.isArray(raw.disabled)) return null;
    return { known: new Set(raw.known), disabled: new Set(raw.disabled), fetchedAt: raw.fetchedAt ?? null };
  } catch {
    return null;
  }
}

function writeCache(known, disabled) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ known: [...known], disabled: [...disabled], fetchedAt: Date.now() })
    );
  } catch {
    // Storage full/unavailable — the in-memory state for this session
    // still works fine, we just lose the cross-restart cache.
  }
}

export function FeatureFlagsProvider({ children }) {
  const { isAuthenticated, profile } = useAuth();
  // known = flags that exist; disabled = flags evaluated OFF for me.
  // Hydrated synchronously from the last successful fetch (if any) so
  // there's no "everything's on by default" gap while the network call
  // that follows is still in flight.
  const cachedRef = useRef(null);
  if (cachedRef.current === null) cachedRef.current = readCache() ?? { known: new Set(), disabled: new Set(), fetchedAt: null };

  const [known, setKnown]           = useState(() => cachedRef.current.known);
  const [disabled, setDisabled]     = useState(() => cachedRef.current.disabled);
  const [lastUpdated, setLastUpdated] = useState(() => cachedRef.current.fetchedAt);
  const [isStale, setIsStale]       = useState(() => cachedRef.current.fetchedAt !== null);
  const [loading, setLoading]       = useState(true);
  const hasLoadedOnceRef = useRef(false);

  const load = useCallback(async () => {
    // Demo / unconfigured: nothing gated (everything on) — unchanged
    // from before, this isn't a "we lost the config" case.
    if (!isSupabaseConfigured) {
      setKnown(new Set());
      setDisabled(new Set());
      setLoading(false);
      hasLoadedOnceRef.current = true;
      return;
    }

    setLoading(true);
    const { data, error } = await FeatureFlagsAPI.my();

    if (error || !Array.isArray(data)) {
      // Fetch failed — deliberately leave `known`/`disabled` untouched.
      // If this device has never successfully loaded flags before AND
      // has no cache either, there's genuinely nothing safer to fall
      // back to than the documented "unknown ⇒ not gated" default,
      // which is exactly what the current (unset) state already gives.
      console.warn('[featureFlags] refresh failed, keeping last known configuration');
      setIsStale(true);
      setLoading(false);
      hasLoadedOnceRef.current = true;
      return;
    }

    const k = new Set();
    const d = new Set();
    data.forEach(f => {
      k.add(f.key);
      if (!f.enabled) d.add(f.key);
    });
    setKnown(k);
    setDisabled(d);
    setIsStale(false);
    setLastUpdated(Date.now());
    setLoading(false);
    hasLoadedOnceRef.current = true;
    writeCache(k, d);
  }, []);

  // Initial load + reload when auth state changes (role can affect
  // audience targeting).
  useEffect(() => { load(); }, [load, isAuthenticated, profile?.role]);

  // Foreground-triggered refresh — an emergency kill switch should
  // propagate as soon as the user comes back to the app, not wait for
  // the next full relaunch.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let cancelled = false;
      let handle;
      (async () => {
        const { App } = await import('@capacitor/app');
        if (cancelled) return;
        handle = await App.addListener('appStateChange', (state) => {
          if (state.isActive) load();
        });
      })();
      return () => {
        cancelled = true;
        handle?.remove?.();
      };
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [load]);

  // Periodic re-check while the app stays open in the foreground — the
  // second half of "an emergency kill switch shouldn't need a restart".
  useEffect(() => {
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const isEnabled = useCallback((key) => {
    if (!known.has(key)) return true;   // unknown ⇒ not gated
    return !disabled.has(key);
  }, [known, disabled]);

  return (
    <FeatureFlagsContext.Provider value={{ isEnabled, loading, isStale, lastUpdated, reload: load }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

/** Boolean hook: const walletOn = useFeatureFlag('wallet'); */
export function useFeatureFlag(key) {
  const { isEnabled } = useContext(FeatureFlagsContext);
  return isEnabled(key);
}

/** Render children only when a feature is enabled for this user. */
export function Feature({ flag, children, fallback = null }) {
  const { isEnabled } = useContext(FeatureFlagsContext);
  return isEnabled(flag) ? children : fallback;
}
