import React, { useEffect, useRef } from 'react';
import { loadMapbox } from '@/lib/maps';

export default function VillageMap({ villageName, vendors = [] }) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    async function init() {
      const mapboxgl = await loadMapbox();
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [86.07, 26.35], // Default Madhepur
        zoom: 14
      });

      map.current.on('load', () => {
        vendors.forEach(v => {
          if (v.lng && v.lat) {
            new mapboxgl.Marker({ color: '#F97316' })
              .setLngLat([v.lng, v.lat])
              .setPopup(new mapboxgl.Popup().setHTML(`<b>${v.name}</b>`))
              .addTo(map.current);
          }
        });
      });
    }
    init();
    return () => map.current?.remove();
  }, [vendors]);

  return <div ref={mapContainer} className="w-full h-full min-h-[200px] rounded-xl overflow-hidden border border-border" />;
}
