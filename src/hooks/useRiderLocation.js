import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Tracks rider's GPS and syncs to Supabase.
 * @param {string} riderId - DB uuid of the rider
 * @param {boolean} enabled - whether to track
 */
export function useRiderLocation(riderId, enabled = false) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const watchId = useRef(null);
  const lastSync = useRef(0);

  useEffect(() => {
    if (!enabled || !riderId || !navigator.geolocation) return;

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newLoc = { lat: latitude, lng: longitude, accuracy };
        setLocation(newLoc);

        // Sync to Supabase every 15 seconds to save battery
        const now = Date.now();
        if (now - lastSync.current > 15000) {
          syncLocation(riderId, newLoc);
          lastSync.current = now;
        }
      },
      (err) => {
        console.error('[GPS Error]', err);
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000
      }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [riderId, enabled]);

  const syncLocation = async (id, loc) => {
    try {
      await supabase
        .from('rider_locations')
        .upsert({
          rider_id: id,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          recorded_at: new Date().toISOString()
        });

      // Also log to history
      await supabase
        .from('rider_location_history')
        .insert({
          rider_id: id,
          lat: loc.lat,
          lng: loc.lng
        });
    } catch (e) {
      console.error('[Sync Location Failed]', e);
    }
  };

  return { location, error };
}
