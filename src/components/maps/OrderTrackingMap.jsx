import React, { useEffect, useRef, useState } from 'react';
import { loadMapbox, MADHEPUR_CENTER } from '@/lib/maps';
import { supabase } from '@/lib/supabase';
import { Loader2, Bike, MapPin } from 'lucide-react';

export default function OrderTrackingMap({ riderId, vendorLoc, customerLoc }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const riderMarker = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const mapboxgl = await loadMapbox();
      if (!mapContainer.current) return;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: vendorLoc ? [vendorLoc.lng, vendorLoc.lat] : MADHEPUR_CENTER,
        zoom: 13,
      });

      map.current.on('load', () => {
        setLoading(false);

        // Add Vendor Marker
        if (vendorLoc) {
          new mapboxgl.Marker({ color: '#0ea5e9' }) // primary
            .setLngLat([vendorLoc.lng, vendorLoc.lat])
            .addTo(map.current);
        }

        // Add Customer Marker
        if (customerLoc) {
          new mapboxgl.Marker({ color: '#f59e0b' }) // amber
            .setLngLat([customerLoc.lng, customerLoc.lat])
            .addTo(map.current);
        }
      });
    }

    init();

    return () => map.current?.remove();
  }, [vendorLoc, customerLoc]);

  // Real-time rider tracking
  useEffect(() => {
    if (!riderId || !map.current) return;

    const channel = supabase
      .channel(`rider-loc-${riderId}`)
      .on('postgres_changes', {
        event: 'INSERT', // we mostly insert into history or upsert current
        schema: 'public',
        table: 'rider_locations',
        filter: `rider_id=eq.${riderId}`
      }, (payload) => {
        const { lat, lng } = payload.new;
        updateRiderMarker(lat, lng);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderId]);

  const updateRiderMarker = async (lat, lng) => {
    const mapboxgl = await loadMapbox();
    if (!riderMarker.current) {
      const el = document.createElement('div');
      el.className = 'rider-marker';
      el.innerHTML = '🛵';
      el.style.fontSize = '24px';

      riderMarker.current = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(map.current);
    } else {
      riderMarker.current.setLngLat([lng, lat]);
    }

    // Smoothly pan to rider if they are moving
    map.current.easeTo({ center: [lng, lat], duration: 2000 });
  };

  return (
    <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-border shadow-inner">
      {loading && (
        <div className="absolute inset-0 z-20 bg-muted/20 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
