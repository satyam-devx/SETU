// ═══════════════════════════════════════════════════════════
// SETU — VillageProvider (v2)
//
// v1 fetched `profiles.village_id` and the matching `villages` row
// exactly once on mount, then never again. `profiles.village_id` is
// also mirrored on AuthContext's `profile` and *does* change after
// mount — onboarding, CustomerProfile's "Edit Profile" village
// picker, and CustomerHome's quick village-switcher all write to it
// via `updateProfile()`/`reloadProfile()`. Because this provider
// never re-read it, every one of those flows left `useVillage()`
// showing the OLD village everywhere (Home's "Delivering to" label,
// CustomerVendors' vendor list, CustomerCheckout's order village_id)
// until a full app reload — silently scoping vendor discovery and
// order placement to the wrong village. It also never accounted for
// demo mode at all, where the demo profile's village_id ('madhepur')
// didn't match the hardcoded initial village ('prasad') — so the
// very first thing a demo session showed on Home was already wrong.
//
// Fix: `profile.village_id` (from AuthContext, the single source of
// truth) drives `village` here directly, so any writer of
// `profiles.village_id` — real or demo — stays in sync automatically,
// with no separate village-context setter for each call site to
// remember to invoke.
// ═══════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getVillages, getVillageById } from './api';
import { useAuth } from './AuthContext';

const VillageContext = createContext(null);

export function VillageProvider({ children }) {
  const { profile, isLoading: authLoading } = useAuth();
  const [villages, setVillages]       = useState([]);
  const [village, setVillageState]    = useState(null);
  const [loading, setLoading]         = useState(true);

  // Active-village list — used to resolve the current village quickly
  // and to power "change village" pickers (CustomerHome, CustomerProfile)
  // without each one fetching its own copy.
  useEffect(() => {
    let mounted = true;
    getVillages({ activeOnly: true }).then(({ data }) => {
      if (mounted && data?.length) setVillages(data);
    });
    return () => { mounted = false; };
  }, []);

  // Resolve `village` from the signed-in user's `profile.village_id`
  // every time it changes.
  useEffect(() => {
    if (authLoading) return;
    const targetId = profile?.village_id;
    if (!targetId) { setLoading(false); return; }

    const cached = villages.find(v => v.id === targetId);
    if (cached) { setVillageState(cached); setLoading(false); return; }

    // Not in the (active-only) cached list yet — either it hasn't
    // loaded, or the profile points at a village that's since gone
    // inactive. Resolve it directly rather than getting stuck on a
    // stale or wrong village.
    let mounted = true;
    getVillageById(targetId).then(({ data }) => {
      if (!mounted) return;
      if (data) setVillageState(data);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [profile?.village_id, villages, authLoading]);

  return (
    <VillageContext.Provider value={{
      village,
      villageId: village?.id ?? null,
      villages,
      loading,
    }}>
      {children}
    </VillageContext.Provider>
  );
}

export function useVillage() {
  const context = useContext(VillageContext);
  if (!context) throw new Error('useVillage must be used within a VillageProvider');
  return context;
}
