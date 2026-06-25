// ═══════════════════════════════════════════════════════════
// SETU — Feature Flags (client)
//
// Loads the caller's server-evaluated flag set (my_feature_flags,
// migration 022) once on auth and exposes useFeatureFlag(key) / <Feature>.
// Evaluation (enable/rollout/audience) is done server-side, so the client
// only stores the result. Unknown flags default to ON (not gated), so a
// missing flag never hides an existing feature.
//
// This gates UI only; backend RPCs/Edge Functions gate themselves via
// is_feature_enabled() — the client is never the security boundary.
// ═══════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured } from './supabase';
import { FeatureFlagsAPI } from './api';
import { useAuth } from './AuthContext';

const FeatureFlagsContext = createContext({
  isEnabled: () => true,
  loading: true,
  reload: () => {},
});

export function FeatureFlagsProvider({ children }) {
  const { isAuthenticated, profile } = useAuth();
  // known = flags that exist; disabled = flags evaluated OFF for me.
  const [known, setKnown]       = useState(() => new Set());
  const [disabled, setDisabled] = useState(() => new Set());
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    // Demo / unconfigured: nothing gated (everything on).
    if (!isSupabaseConfigured) { setKnown(new Set()); setDisabled(new Set()); setLoading(false); return; }
    setLoading(true);
    const { data } = await FeatureFlagsAPI.my();
    const k = new Set();
    const d = new Set();
    (Array.isArray(data) ? data : []).forEach(f => {
      k.add(f.key);
      if (!f.enabled) d.add(f.key);
    });
    setKnown(k);
    setDisabled(d);
    setLoading(false);
  }, []);

  // Reload when auth state changes (role can affect audience targeting).
  useEffect(() => { load(); }, [load, isAuthenticated, profile?.role]);

  const isEnabled = useCallback((key) => {
    if (!known.has(key)) return true;   // unknown ⇒ not gated
    return !disabled.has(key);
  }, [known, disabled]);

  return (
    <FeatureFlagsContext.Provider value={{ isEnabled, loading, reload: load }}>
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
