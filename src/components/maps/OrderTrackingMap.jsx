import React, { useEffect, useRef, useState } from 'react';
import { loadMapbox, calculateETA, getDistance } from '@/lib/maps';
import { supabase } from '@/lib/supabase';
import { Loader2, MapPin, WifiOff, Clock } from 'lucide-react';

export default function OrderTrackingMap({ riderId, vendorLoc, customerLoc }) {
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const riderMarker  = useRef(null);
  const [loading, setLoading]   = useState(true);
  const [mapError, setMapError] = useState(false);
  const [eta, setEta]           = useState(null);   // minutes

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const mapboxgl = await loadMapbox();
        if (!mounted || !mapContainer.current) return;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style:     'mapbox://styles/mapbox/streets-v12',
          center:    [vendorLoc.lng, vendorLoc.lat],
          zoom:      13,
        });

        map.current.on('load', () => {
          if (!mounted) return;
          setLoading(false);

          // Vendor marker (green — pickup point)
          new mapboxgl.Marker({ color: '#10B981' })
            .setLngLat([vendorLoc.lng, vendorLoc.lat])
            .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML('<b>Vendor</b>'))
            .addTo(map.current);

          // Customer marker (blue — drop-off point)
          new mapboxgl.Marker({ color: '#3B82F6' })
            .setLngLat([customerLoc.lng, customerLoc.lat])
            .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML('<b>Your Location</b>'))
            .addTo(map.current);

          // Fit both points in view
          const bounds = new mapboxgl.LngLatBounds()
            .extend([vendorLoc.lng, vendorLoc.lat])
            .extend([customerLoc.lng, customerLoc.lat]);
          map.current.fitBounds(bounds, { padding: 60 });
        });

        map.current.on('error', (e) => {
          console.error('[OrderTrackingMap] Mapbox error:', e.error);
          if (mounted) setMapError(true);
        });

        // Realtime rider location subscription
        if (riderId) {
          const channel = supabase
            .channel(`rider-loc-${riderId}`)
            .on('postgres_changes', {
              event:  'UPDATE',
              schema: 'public',
              table:  'rider_locations',
              filter: `rider_id=eq.${riderId}`,
            }, (payload) => {
              if (!mounted || !map.current) return;
              const { lat, lng } = payload.new;

              if (!riderMarker.current) {
                // Create rider marker on first location update
                riderMarker.current = new mapboxgl.Marker({ color: '#F97316' })
                  .setLngLat([lng, lat])
                  .addTo(map.current);
              } else {
                riderMarker.current.setLngLat([lng, lat]);
              }

              // Pan map to follow rider
              map.current.easeTo({ center: [lng, lat], duration: 800 });

              // Calculate and update ETA from rider's position to customer
              const distToCustomer = getDistance(lat, lng, customerLoc.lat, customerLoc.lng);
              setEta(calculateETA(distToCustomer));
            })
            .subscribe();

          return () => supabase.removeChannel(channel);
        }

      } catch (err) {
        console.error('[OrderTrackingMap] Failed to load Mapbox:', err);
        if (mounted) {
          setLoading(false);
          setMapError(true);
        }
      }
    }

    const cleanup = init();
    return () => {
      mounted = false;
      cleanup?.then?.(fn => fn?.());
      map.current?.remove();
    };
  }, [riderId]);

  if (mapError) {
    return (
      <div className="relative w-full min-h-[300px] rounded-2xl overflow-hidden bg-muted border border-border
                      flex flex-col items-center justify-center gap-3 text-muted-foreground p-4">
        <WifiOff className="w-8 h-8" />
        <p className="text-sm font-medium text-center">Live tracking map unavailable</p>
        <p className="text-xs text-center opacity-70">Your order is on its way — we'll notify you when it arrives</p>
        <div className="mt-2 grid grid-cols-2 gap-2 w-full max-w-xs text-xs">
          <div className="flex items-center gap-2 bg-background rounded-lg p-2 border border-border">
            <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <span className="truncate">Pickup: {vendorLoc.name ?? 'Vendor'}</span>
          </div>
          <div className="flex items-center gap-2 bg-background rounded-lg p-2 border border-border">
            <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
            <span className="truncate">Drop: Your Address</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[300px] rounded-2xl overflow-hidden bg-muted">
      <div ref={mapContainer} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* ETA overlay — shown once rider is tracked */}
      {eta !== null && !loading && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-background/90 backdrop-blur rounded-xl px-4 py-3 border border-border
                          flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-xs font-medium">Rider on the way</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-bold text-primary">{eta} mins</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
