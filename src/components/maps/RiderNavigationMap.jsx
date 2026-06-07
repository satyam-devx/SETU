import React, { useEffect, useRef, useState } from 'react';
import { loadMapbox, calculateETA, getDistance } from '@/lib/maps';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Navigation, CheckCircle } from 'lucide-react';

export default function RiderNavigationMap({ currentLocation, destination, onArrived }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const riderMarker = useRef(null);
  const [dist, setDist] = useState(null);

  useEffect(() => {
    async function init() {
      const mapboxgl = await loadMapbox();
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: [currentLocation?.lng || 86.07, currentLocation?.lat || 26.35],
        zoom: 15,
        pitch: 45
      });

      map.current.on('load', () => {
        // Destination Marker
        new mapboxgl.Marker({ color: '#EF4444' })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map.current);

        if (currentLocation) {
          riderMarker.current = new mapboxgl.Marker({ color: '#F97316' })
            .setLngLat([currentLocation.lng, currentLocation.lat])
            .addTo(map.current);
        }
      });
    }
    init();
    return () => map.current?.remove();
  }, []);

  useEffect(() => {
    if (map.current && currentLocation && riderMarker.current) {
      riderMarker.current.setLngLat([currentLocation.lng, currentLocation.lat]);
      map.current.easeTo({ center: [currentLocation.lng, currentLocation.lat] });

      const d = getDistance(currentLocation.lat, currentLocation.lng, destination.lat, destination.lng);
      setDist(d);
    }
  }, [currentLocation]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={mapContainer} className="w-full h-full rounded-2xl" />

      <div className="absolute top-4 left-4 right-4">
        <Card className="p-3 bg-background/90 backdrop-blur border-border flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Next Destination</p>
            <p className="text-sm font-bold truncate">{destination.address || 'Delivery Address'}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-primary">{dist ? dist.toFixed(1) : '--'} km</p>
            <p className="text-[10px] font-medium text-muted-foreground">{dist ? calculateETA(dist) : '--'} mins</p>
          </div>
        </Card>
      </div>

      <div className="absolute bottom-6 left-4 right-4">
        <Button
          className="w-full h-14 rounded-2xl text-lg font-black shadow-xl"
          disabled={!dist || dist > 0.1}
          onClick={onArrived}
        >
          {dist && dist <= 0.1 ? (
            <><CheckCircle className="mr-2" /> I HAVE ARRIVED</>
          ) : (
            <><Navigation className="mr-2 animate-pulse" /> NAVIGATING...</>
          )}
        </Button>
      </div>
    </div>
  );
}
