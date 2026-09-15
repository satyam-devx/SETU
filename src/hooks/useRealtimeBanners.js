// ═══════════════════════════════════════════════════════════
// SETU — useRealtimeBanners
//
// Home's banner carousel used to render a hardcoded static array —
// it never queried the `banners` table at all, which is the real
// reason admin banner changes never reached customers: there was
// nothing wired up to reflect them, realtime or otherwise. This hook
// does the actual fetch AND subscribes to INSERT/UPDATE/DELETE on
// `banners` so admin changes (content, colors, order, active state)
// propagate without the customer reloading the app.
//
// Any change just triggers a full refetch rather than patching
// individual rows in place — banners are a small, infrequently-
// changing table, so correctness (server-side is_active/date-window/
// village filtering always wins) is simpler and cheaper here than
// diffing realtime payloads by hand.
//
// Falls back to a slow background poll (5 min) in case a realtime
// event is ever missed (dropped connection, etc.) — a safety net,
// not the primary mechanism.
// ═══════════════════════════════════════════════════════════
import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getBanners } from '@/lib/api';

const FALLBACK_POLL_MS = 5 * 60 * 1000;

export function useRealtimeBanners(villageId) {
  const [banners,   setBanners]   = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState(null);
  const mountedRef = useRef(true);

  const fetchBanners = useCallback(async () => {
    const { data, error: fetchError } = await getBanners({ villageId });
    if (!mountedRef.current) return;
    if (fetchError) {
      setError(fetchError);
    } else {
      setBanners(data ?? []);
      setError(null);
    }
    setIsLoading(false);
  }, [villageId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Initial fetch + refetch whenever village changes.
  useEffect(() => {
    setIsLoading(true);
    fetchBanners();
  }, [fetchBanners]);

  // Realtime subscription.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('banners-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, () => {
        fetchBanners();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // fetchBanners is memoized on villageId — a new subscription per
    // village change is fine (the old one is torn down first) and
    // avoids the "callbacks added after subscribe()" issue from
    // resubscribing with a stale closure.
  }, [fetchBanners]);

  // Fallback poll — only matters if a realtime event was missed.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const id = setInterval(fetchBanners, FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [fetchBanners]);

  return { banners, isLoading, error, refetch: fetchBanners };
}
