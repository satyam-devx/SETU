import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook for tracking and reporting rider GPS location
 */
export function useRiderLocation(riderId, isOnline = false) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const watchId = useRef(null);
  const lastUpdate = useRef(0);

  const UPDATE_INTERVAL = 10000; // 10 seconds

  useEffect(() => {
    if (!riderId || !isOnline) {
      if (watchId.current) {
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

        // Throttle database updates
        if (now - lastUpdate.current > UPDATE_INTERVAL) {
          try {
            await supabase.from('rider_locations').upsert({
              rider_id: riderId,
              lat,
              lng,
              accuracy,
              recorded_at: new Date().toISOString()
            }, { onConflict: 'rider_id' });
            
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
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );

    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [riderId, isOnline]);

  return { location, error };
}
