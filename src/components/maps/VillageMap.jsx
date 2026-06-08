import React, { useEffect, useRef, useState } from 'react';
import { loadMapbox, VILLAGE_COORDINATES, MADHEPUR_CENTER } from '@/lib/maps';
import { MapPin, WifiOff } from 'lucide-react';

export default function VillageMap({ villageName, vendors = [] }) {
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const [loading, setLoading]       = useState(true);
  const [mapError, setMapError]     = useState(false);

  // Resolve center from villageName — fall back to Madhepur if unknown
  const coords = VILLAGE_COORDINATES[villageName] ?? { lat: MADHEPUR_CENTER[1], lng: MADHEPUR_CENTER[0] };

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const mapboxgl = await loadMapbox();
        if (!mounted || !mapContainer.current) return;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style:     'mapbox://styles/mapbox/light-v11',
          center:    [coords.lng, coords.lat],
          zoom:      14,
        });

        map.current.on('load', () => {
          if (!mounted) return;
          setLoading(false);

          vendors.forEach(v => {
            if (typeof v.lng === 'number' && typeof v.lat === 'number') {
              new mapboxgl.Marker({ color: '#F97316' })
                .setLngLat([v.lng, v.lat])
                .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(
                  `<div style="font-size:13px;font-weight:600">${v.name}</div>
                   <div style="font-size:11px;color:#666">${v.category ?? ''}</div>`
                ))
                .addTo(map.current);
            }
          });
        });

        map.current.on('error', (e) => {
          console.error('[VillageMap] Mapbox error:', e.error);
          if (mounted) setMapError(true);
        });

      } catch (err) {
        console.error('[VillageMap] Failed to load Mapbox:', err);
        if (mounted) {
          setLoading(false);
          setMapError(true);
        }
      }
    }

    init();
    return () => {
      mounted = false;
      map.current?.remove();
    };
  // Re-initialise if village changes — different center + vendor pins
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageName]);

  if (mapError) {
    return (
      <div className="w-full h-full min-h-[200px] rounded-xl overflow-hidden border border-border
                      bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <WifiOff className="w-6 h-6" />
        <p className="text-xs font-medium">{villageName ?? 'Village'} Map Unavailable</p>
        <p className="text-[10px] opacity-70">Check your connection and try again</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2 px-4">
          {vendors.slice(0, 5).map(v => (
            <div key={v.id} className="flex items-center gap-1 text-[10px] bg-background rounded-full px-2 py-0.5 border border-border">
              <MapPin className="w-2.5 h-2.5 text-primary" />
              <span>{v.name}</span>
            </div>
          ))}
          {vendors.length > 5 && (
            <span className="text-[10px] text-muted-foreground">+{vendors.length - 5} more</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[200px] rounded-xl overflow-hidden border border-border">
      <div ref={mapContainer} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
