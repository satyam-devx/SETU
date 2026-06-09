// ═══════════════════════════════════════════════════════════
// OrderTrackingMap — Leaflet (no API key required)
//
// Customer-facing live tracking map.
// Uses OpenStreetMap tiles so it works in any network without
// a Mapbox token. Rider position updates via Supabase Realtime.
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { initLeaflet, calculateETA, getDistance } from '@/lib/maps';
import { supabase } from '@/lib/supabase';
import { Loader2, WifiOff, Clock } from 'lucide-react';

// OSM tile URL — no key needed
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function OrderTrackingMap({ riderId, vendorLoc, customerLoc }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);   // Leaflet map instance
  const riderRef     = useRef(null);   // rider marker
  const channelRef   = useRef(null);   // Supabase channel

  const [loading,  setLoading]  = useState(true);
  const [mapError, setMapError] = useState(false);
  const [eta,      setEta]      = useState(null); // minutes

  // ── Build map once on mount ───────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const L = await initLeaflet();
        if (!mounted || !containerRef.current) return;

        // Leaflet attaches directly to the DOM node
        const map = L.map(containerRef.current, { zoomControl: true });
        mapRef.current = map;

        L.tileLayer(TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);

        // Vendor marker — green
        const greenIcon = L.divIcon({
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#10B981;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([vendorLoc.lat, vendorLoc.lng], { icon: greenIcon })
          .addTo(map)
          .bindPopup(`<b>${vendorLoc.name ?? 'Vendor'}</b>`);

        // Customer marker — blue
        const blueIcon = L.divIcon({
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#3B82F6;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([customerLoc.lat, customerLoc.lng], { icon: blueIcon })
          .addTo(map)
          .bindPopup('<b>Your Location</b>');

        // Fit both points in view
        const bounds = L.latLngBounds(
          [vendorLoc.lat, vendorLoc.lng],
          [customerLoc.lat, customerLoc.lng]
        );
        map.fitBounds(bounds, { padding: [40, 40] });

        if (mounted) setLoading(false);

        // ── Realtime rider location ───────────────────────
        if (riderId) {
          const orangeIcon = L.divIcon({
            html: '<div style="width:16px;height:16px;border-radius:50%;background:#F97316;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
            className: '',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          channelRef.current = supabase
            .channel(`rider-loc-${riderId}`)
            .on('postgres_changes', {
              event:  'UPDATE',
              schema: 'public',
              table:  'rider_locations',
              filter: `rider_id=eq.${riderId}`,
            }, (payload) => {
              if (!mounted || !mapRef.current) return;
              const { lat, lng } = payload.new;

              if (!riderRef.current) {
                riderRef.current = L.marker([lat, lng], { icon: orangeIcon })
                  .addTo(mapRef.current)
                  .bindPopup('🛵 Rider');
              } else {
                riderRef.current.setLatLng([lat, lng]);
              }

              // Pan map to follow rider smoothly
              mapRef.current.panTo([lat, lng], { animate: true, duration: 0.8 });

              // Update ETA
              const dist = getDistance(lat, lng, customerLoc.lat, customerLoc.lng);
              setEta(calculateETA(dist));
            })
            .subscribe();
        }

      } catch (err) {
        console.error('[OrderTrackingMap] init error:', err);
        if (mounted) { setLoading(false); setMapError(true); }
      }
    }

    init();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // Map re-initialises only if the route changes (vendor/customer coords)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId, vendorLoc.lat, vendorLoc.lng, customerLoc.lat, customerLoc.lng]);

  // ── Offline fallback ──────────────────────────────────────
  if (mapError) {
    return (
      <div className="relative w-full h-full min-h-[256px] bg-muted border-b border-border
                      flex flex-col items-center justify-center gap-3 text-muted-foreground p-4">
        <WifiOff className="w-8 h-8" />
        <p className="text-sm font-medium text-center">Live tracking unavailable</p>
        <p className="text-xs text-center opacity-70">Your order is on its way — we'll notify you when it arrives</p>
        <div className="mt-2 grid grid-cols-2 gap-2 w-full max-w-xs text-xs">
          <div className="flex items-center gap-2 bg-background rounded-lg p-2 border border-border">
            <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
            <span className="truncate">{vendorLoc.name ?? 'Vendor'}</span>
          </div>
          <div className="flex items-center gap-2 bg-background rounded-lg p-2 border border-border">
            <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
            <span className="truncate">Your Address</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[256px] bg-muted">
      {/* Leaflet attaches to this node */}
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* ETA overlay — shown once rider position is received */}
      {eta !== null && !loading && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
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
