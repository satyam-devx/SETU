import React, { useEffect, useRef, useState } from 'react';
import { loadMapbox, MADHEPUR_CENTER, VILLAGE_COORDINATES } from '@/lib/maps';
import { Loader2, Store, Bike } from 'lucide-react';

export default function VillageMap({ villageName, vendors = [], riders = [] }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loading, setLoading] = useState(true);

  const center = VILLAGE_COORDINATES[villageName] || { lat: MADHEPUR_CENTER[1], lng: MADHEPUR_CENTER[0] };

  useEffect(() => {
    async function init() {
      const mapboxgl = await loadMapbox();
      if (!mapContainer.current) return;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [center.lng, center.lat],
        zoom: 14,
      });

      map.current.on('load', () => {
        setLoading(false);

        // Add vendors as store icons
        vendors.forEach(v => {
          if (v.lat && v.lng) {
            const el = document.createElement('div');
            el.className = 'vendor-pin bg-white p-1 rounded-full border-2 border-primary shadow-sm';
            el.innerHTML = '🏪';
            new mapboxgl.Marker(el)
              .setLngLat([v.lng, v.lat])
              .setPopup(new mapboxgl.Popup().setHTML(`<p class="text-xs font-bold">${v.name}</p>`))
              .addTo(map.current);
          }
        });

        // Add riders as bike icons
        riders.forEach(r => {
          if (r.lat && r.lng) {
             const el = document.createElement('div');
             el.innerHTML = '🛵';
             el.style.fontSize = '20px';
             new mapboxgl.Marker(el)
               .setLngLat([r.lng, r.lat])
               .addTo(map.current);
          }
        });
      });
    }

    init();
    return () => map.current?.remove();
  }, [villageName, vendors, riders]);

  return (
    <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-border">
      {loading && (
        <div className="absolute inset-0 z-20 bg-muted/20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
