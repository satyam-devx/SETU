// ═══════════════════════════════════════════════════════════
// SETU — useRiderLocation
//
// Fix log (Phase 0):
//  - Hook now accepts userId (auth UID) instead of riderId.
//  - It resolves riders.id (PK) from riders.user_id = userId
//    on mount so GPS upserts use the correct FK.
//  - Exposed resolvedRiderId so callers can pass it to other
//    rider-scoped hooks (useRealtimeOrders, etc.).
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Track and report a rider's GPS position.
 *
 * @param {string|null} userId   - Auth user UUID (auth.users.id)
 * @param {boolean}     isOnline - Only publish location when true
 * @returns {{ location, error, riderId: string|null }}
 */
export function useRiderLocation(userId, isOnline = false) {
  const [location,         setLocation]         = useState(null);
  const [error,            setError]            = useState(null);
  const [resolvedRiderId,  setResolvedRiderId]  = useState(null);

  const watchId    = useRef(null);
  const lastUpdate = useRef(0);
  const UPDATE_INTERVAL = 10_000; // ms

  // ── Resolve riders.id from auth user_id ─────────────────
  useEffect(() => {
    if (!userId) return;

    supabase
      .from('riders')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e) {
          console.error('[useRiderLocation] Could not resolve rider id:', e.message);
          return;
        }
        if (data?.id) setResolvedRiderId(data.id);
      });
  }, [userId]);

  // ── GPS watch ────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedRiderId || !isOnline) {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const now = Date.now();

        setLocation({ lat, lng, accuracy });

        if (now - lastUpdate.current > UPDATE_INTERVAL) {
          try {
            await supabase.from('rider_locations').upsert(
              {
                rider_id:    resolvedRiderId,
                lat,
                lng,
                accuracy,
                recorded_at: new Date().toISOString(),
              },
              { onConflict: 'rider_id' }
            );
            lastUpdate.current = now;
          } catch (err) {
            console.error('[GPS] Upsert failed:', err);
          }
        }
      },
      (err) => {
        setError(err.message);
        console.error('[GPS] Error:', err);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [resolvedRiderId, isOnline]);

  return { location, error, riderId: resolvedRiderId };
}
