import React, { useEffect, useRef, useState } from 'react';
import { loadMapbox, MADHEPUR_CENTER } from '@/lib/maps';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import { Loader2, Navigation, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RiderNavigationMap({ riderUuid, destination }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [loading, setLoading] = useState(true);
  const { location: riderLoc } = useRiderLocation(riderUuid, true);

  useEffect(() => {
    async function init() {
      const mapboxgl = await loadMapbox();
      if (!mapContainer.current) return;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: riderLoc ? [riderLoc.lng, riderLoc.lat] : MADHEPUR_CENTER,
        zoom: 16,
        pitch: 60, // 3D view
      });

      map.current.on('load', () => {
        setLoading(false);

        // Add destination marker
        if (destination) {
          new mapboxgl.Marker({ color: '#f43f5e' }) // rose-500
            .setLngLat([destination.lng, destination.lat])
            .addTo(map.current);
        }
      });
    }

    init();
    return () => map.current?.remove();
  }, [destination]);

  // Update center when rider moves
  useEffect(() => {
    if (riderLoc && map.current) {
      map.current.easeTo({
        center: [riderLoc.lng, riderLoc.lat],
        bearing: 0, // In real app, get from GPS heading
        duration: 1000
      });
    }
  }, [riderLoc]);

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden border border-border">
      {loading && (
        <div className="absolute inset-0 z-20 bg-background/80 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading Navigation...</p>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Overlay controls */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
        <div className="bg-background/90 backdrop-blur p-3 rounded-2xl border border-border shadow-lg pointer-events-auto">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Next Turn</p>
          <p className="text-sm font-bold flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary rotate-45" />
            Turn Left in 200m
          </p>
        </div>
        <Button size="icon" variant="secondary" className="rounded-full h-12 w-12 shadow-xl pointer-events-auto">
          <Compass className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
