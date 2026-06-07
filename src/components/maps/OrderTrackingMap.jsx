import React, { useEffect, useRef, useState } from 'react';
import { loadMapbox, calculateETA } from '@/lib/maps';
import { supabase } from '@/lib/supabase';
import { Loader2, MapPin } from 'lucide-react';

export default function OrderTrackingMap({ riderId, vendorLoc, customerLoc }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState(null);
  const riderMarker = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const mapboxgl = await loadMapbox();
      if (!mounted) return;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [vendorLoc.lng, vendorLoc.lat],
        zoom: 13
      });

      map.current.on('load', () => {
        setLoading(false);

        // Add Vendor Marker
        new mapboxgl.Marker({ color: '#10B981' }) // Green
          .setLngLat([vendorLoc.lng, vendorLoc.lat])
          .addTo(map.current);

        // Add Customer Marker
        new mapboxgl.Marker({ color: '#3B82F6' }) // Blue
          .setLngLat([customerLoc.lng, customerLoc.lat])
          .addTo(map.current);

        // Initial bounds
        const bounds = new mapboxgl.LngLatBounds()
          .extend([vendorLoc.lng, vendorLoc.lat])
          .extend([customerLoc.lng, customerLoc.lat]);
        map.current.fitBounds(bounds, { padding: 50 });
      });

      // Subscribe to Rider Location
      if (riderId) {
        const channel = supabase
          .channel(`rider-loc-${riderId}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'rider_locations',
            filter: `rider_id=eq.${riderId}`
          }, (payload) => {
            const { lat, lng } = payload.new;
            if (!riderMarker.current) {
              riderMarker.current = new mapboxgl.Marker({ color: '#F97316' }) // Orange
                .setLngLat([lng, lat])
                .addTo(map.current);
            } else {
              riderMarker.current.setLngLat([lng, lat]);
            }
            // Update ETA based on distance to customer
            // ... (simplified)
          })
          .subscribe();

        return () => supabase.removeChannel(channel);
      }
    }

    init();
    return () => { mounted = false; if (map.current) map.current.remove(); };
  }, [riderId]);

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden bg-muted">
      <div ref={mapContainer} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
