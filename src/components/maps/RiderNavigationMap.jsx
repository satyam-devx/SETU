import React, { useEffect, useRef, useState } from 'react';
import { loadMapbox, calculateETA, getDistance } from '@/lib/maps';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Navigation, CheckCircle, WifiOff } from 'lucide-react';

export default function RiderNavigationMap({ currentLocation, destination, onArrived }) {
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const riderMarker  = useRef(null);
  const [dist, setDist]         = useState(null);
  const [mapError, setMapError] = useState(false);
  const [loaded, setLoaded]     = useState(false);

  // ── Initial map load ──────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const mapboxgl = await loadMapbox();
        if (!mounted || !mapContainer.current) return;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style:     'mapbox://styles/mapbox/navigation-night-v1',
          center:    [currentLocation?.lng ?? 86.07, currentLocation?.lat ?? 26.35],
          zoom:      15,
          pitch:     45,
        });

        map.current.on('load', () => {
          if (!mounted) return;
          setLoaded(true);

          // Destination marker (red)
          new mapboxgl.Marker({ color: '#EF4444' })
            .setLngLat([destination.lng, destination.lat])
            .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(
              `<b>${destination.address ?? 'Destination'}</b>`
            ))
            .addTo(map.current);

          // Rider marker (orange) — only if location available on mount
          if (currentLocation) {
            riderMarker.current = new mapboxgl.Marker({ color: '#F97316' })
              .setLngLat([currentLocation.lng, currentLocation.lat])
              .addTo(map.current);
          }
        });

        map.current.on('error', (e) => {
          console.error('[RiderNavigationMap] Mapbox error:', e.error);
          if (mounted) setMapError(true);
        });

      } catch (err) {
        console.error('[RiderNavigationMap] Failed to load Mapbox:', err);
        if (mounted) setMapError(true);
      }
    }

    init();
    return () => {
      mounted = false;
      map.current?.remove();
    };
  // Only re-mount on destination change; location updates handled by second effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination.lat, destination.lng]);

  // ── Track rider position updates ─────────────────────────
  useEffect(() => {
    if (!map.current || !loaded || !currentLocation) return;

    if (!riderMarker.current) {
      // Lazily create marker when first GPS fix arrives
      loadMapbox().then(mapboxgl => {
        riderMarker.current = new mapboxgl.Marker({ color: '#F97316' })
          .setLngLat([currentLocation.lng, currentLocation.lat])
          .addTo(map.current);
      });
    } else {
      riderMarker.current.setLngLat([currentLocation.lng, currentLocation.lat]);
    }

    map.current.easeTo({
      center:   [currentLocation.lng, currentLocation.lat],
      duration: 600,
    });

    // Update distance to destination
    const d = getDistance(
      currentLocation.lat, currentLocation.lng,
      destination.lat,     destination.lng
    );
    setDist(d);
  }, [currentLocation, loaded, destination.lat, destination.lng]);

  // ── Offline / error fallback ─────────────────────────────
  if (mapError) {
    return (
      <div className="relative w-full h-full min-h-[200px] rounded-2xl overflow-hidden
                      bg-gray-900 border border-border flex flex-col items-center justify-center gap-3 p-4">
        <WifiOff className="w-6 h-6 text-gray-400" />
        <p className="text-sm font-medium text-gray-300">Navigation map unavailable</p>
        {destination.address && (
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 w-full max-w-xs">
            <MapPin className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-gray-200 truncate">{destination.address}</p>
          </div>
        )}
        <Button
          className="w-full max-w-xs mt-2 h-12 rounded-2xl"
          disabled={!dist || dist > 0.1}
          onClick={onArrived}
        >
          {dist && dist <= 0.1
            ? <><CheckCircle className="mr-2 w-5 h-5" /> I HAVE ARRIVED</>
            : <><Navigation className="mr-2 w-5 h-5 animate-pulse" /> NAVIGATING...</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={mapContainer} className="w-full h-full rounded-2xl" />

      {/* HUD overlay */}
      <div className="absolute top-4 left-4 right-4">
        <Card className="p-3 bg-background/90 backdrop-blur border-border flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Next Destination</p>
            <p className="text-sm font-bold truncate">{destination.address ?? 'Delivery Address'}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-primary">{dist != null ? dist.toFixed(1) : '--'} km</p>
            <p className="text-[10px] font-medium text-muted-foreground">
              {dist != null ? calculateETA(dist) : '--'} mins
            </p>
          </div>
        </Card>
      </div>

      {/* Arrival CTA */}
      <div className="absolute bottom-6 left-4 right-4">
        <Button
          className="w-full h-14 rounded-2xl text-lg font-black shadow-xl"
          disabled={!dist || dist > 0.1}
          onClick={onArrived}
        >
          {dist != null && dist <= 0.1
            ? <><CheckCircle className="mr-2" /> I HAVE ARRIVED</>
            : <><Navigation className="mr-2 animate-pulse" /> NAVIGATING...</>}
        </Button>
      </div>
    </div>
  );
}
