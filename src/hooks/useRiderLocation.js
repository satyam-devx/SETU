import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { isNetworkOnline, subscribeNetwork } from '@/lib/network-state';
import { isSetuRealtimeEnabled, publishRiderLocation } from '@/lib/setu-realtime';

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * F6 rider GPS pipeline:
 * - resolve auth user -> riders.id once
 * - stop the GPS watch when offline/background/offline-toggle
 * - use high accuracy only during an active delivery
 * - coalesce many GPS callbacks into the latest point
 * - publish only after a time/distance threshold
 * - upsert the latest location row (the schema intentionally has one current
 *   row per rider); no unbounded client-side location history is created
 */
export function useRiderLocation(userId, isOnline = false, isOnDelivery = false) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [resolvedRiderId, setResolvedRiderId] = useState(null);
  const [networkOnline, setNetworkOnline] = useState(isNetworkOnline());
  const isActive = useAppLifecycle();
  const watchId = useRef(null);
  const latestRef = useRef(null);
  const lastPublishedRef = useRef(null);
  const lastPublishAtRef = useRef(0);
  const flushTimerRef = useRef(null);

  const updateInterval = isOnDelivery ? 10_000 : 30_000;
  const minDistance = isOnDelivery ? 15 : 40;

  useEffect(() => subscribeNetwork(setNetworkOnline), []);

  useEffect(() => {
    if (!userId) {
      setResolvedRiderId(null);
      return undefined;
    }
    let cancelled = false;
    supabase.from('riders').select('id').eq('user_id', userId).maybeSingle().then(({ data, error: e }) => {
      if (cancelled) return;
      if (e) {
        setError(e.message);
        return;
      }
      setResolvedRiderId(data?.id ?? null);
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const clearWatch = () => {
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };

    const flushLatest = async () => {
      if (!resolvedRiderId || !networkOnline || !isActive || !isOnline || !latestRef.current) return;
      const point = latestRef.current;
      const previous = lastPublishedRef.current;
      const moved = distanceMeters(previous, point);
      const elapsed = Date.now() - lastPublishAtRef.current;
      if (previous && moved < minDistance && elapsed < updateInterval) return;

      let published = false;
      if (isSetuRealtimeEnabled()) {
        published = await publishRiderLocation({
          lat: point.lat,
          lng: point.lng,
          accuracy: point.accuracy,
          isOnDelivery,
        });
      }

      // The gateway path persists, caches and fans out the point. If the
      // gateway is unavailable, retain the old direct Supabase write path so
      // rider tracking never depends on the optional realtime service.
      if (!published) {
        const { error: publishError } = await supabase.from('rider_locations').upsert({
          rider_id: resolvedRiderId,
          lat: point.lat,
          lng: point.lng,
          accuracy: point.accuracy,
          is_on_delivery: isOnDelivery,
          recorded_at: new Date().toISOString(),
        }, { onConflict: 'rider_id' });
        if (publishError) {
          setError(publishError.message);
          return;
        }
      }

      lastPublishedRef.current = point;
      lastPublishAtRef.current = Date.now();
      latestRef.current = null;
    };

    if (!resolvedRiderId || !isOnline || !networkOnline || !isActive || !navigator.geolocation) {
      clearWatch();
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
      return () => clearWatch();
    }

    setError(null);
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        latestRef.current = point;
        setLocation(point);
        void flushLatest();
      },
      err => {
        setError(err.message);
      },
      {
        enableHighAccuracy: Boolean(isOnDelivery),
        timeout: isOnDelivery ? 15_000 : 30_000,
        maximumAge: isOnDelivery ? 5_000 : 30_000,
      }
    );

    // Coalescing timer ensures the latest GPS point is eventually published
    // even when the browser/WebView emits callbacks faster than our budget.
    flushTimerRef.current = setInterval(() => { void flushLatest(); }, updateInterval);

    return () => {
      clearWatch();
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    };
  }, [resolvedRiderId, isOnline, isActive, networkOnline, isOnDelivery, minDistance, updateInterval]);

  return { location, error, riderId: resolvedRiderId };
}
