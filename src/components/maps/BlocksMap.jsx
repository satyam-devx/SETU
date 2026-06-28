// ═══════════════════════════════════════════════════════════
// BlocksMap — Leaflet (OpenStreetMap tiles, no API key)
//
// Real, interactive map for the Super Admin "Blocks & Geo" screen.
// Plots each block at its known coordinate (lib/maps VILLAGE_COORDINATES)
// with a popup of live vendor/rider/customer counts. Blocks without a
// known coordinate are listed below the map instead of dropped silently.
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { initLeaflet, VILLAGE_COORDINATES, MADHEPUR_CENTER } from '@/lib/maps';
import { MapPin, WifiOff, Loader2 } from 'lucide-react';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function coordsFor(block) {
  return VILLAGE_COORDINATES[block.name] ?? VILLAGE_COORDINATES[block.district] ?? null;
}

export default function BlocksMap({ blocks = [] }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const layerRef     = useRef(null);   // marker layer group
  const [loading, setLoading]   = useState(true);
  const [mapError, setMapError] = useState(false);

  // Build the map once.
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const L = await initLeaflet();
        if (!mounted || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false });
        mapRef.current = map;
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
        map.setView([MADHEPUR_CENTER[1], MADHEPUR_CENTER[0]], 10);
        layerRef.current = L.layerGroup().addTo(map);

        if (mounted) setLoading(false);
        // Leaflet inside a flex/card container often needs a resize nudge.
        setTimeout(() => mapRef.current?.invalidateSize(), 200);
      } catch (err) {
        console.error('[BlocksMap] init error:', err);
        if (mounted) { setLoading(false); setMapError(true); }
      }
    }
    init();
    return () => {
      mounted = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; layerRef.current = null; }
    };
  }, []);

  // Re-plot markers whenever block data changes.
  useEffect(() => {
    if (loading || mapError || !mapRef.current || !layerRef.current || !window.L) return;
    const L = window.L;
    layerRef.current.clearLayers();

    const points = [];
    blocks.forEach(block => {
      const c = coordsFor(block);
      if (!c) return;
      const active = (block.vendors ?? 0) > 0 || (block.riders ?? 0) > 0;
      const color = active ? '#10B981' : '#9CA3AF';
      const icon = L.divIcon({
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([c.lat, c.lng], { icon })
        .addTo(layerRef.current)
        .bindPopup(
          `<div style="font-size:13px;font-weight:600">${block.name} Block</div>
           <div style="font-size:11px;color:#555">${block.vendors ?? 0} vendors · ${block.riders ?? 0} riders · ${block.customers ?? 0} customers</div>
           <div style="font-size:11px;color:#555">${block.activeVillages ?? 0}/${block.totalVillages ?? 0} villages active</div>`
        );
      points.push([c.lat, c.lng]);
    });

    if (points.length === 1) {
      mapRef.current.setView(points[0], 11);
    } else if (points.length > 1) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
    }
  }, [blocks, loading, mapError]);

  const unmapped = blocks.filter(b => !coordsFor(b));

  if (mapError) {
    return (
      <div className="w-full h-64 rounded-xl border border-border bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <WifiOff className="w-6 h-6" />
        <p className="text-xs font-medium">Map unavailable</p>
        <p className="text-[10px] opacity-70">{blocks.length} blocks · check your connection</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full h-64 rounded-xl overflow-hidden border border-border bg-muted">
        <div ref={containerRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      {!loading && unmapped.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" /> No map coordinate:
          </span>
          {unmapped.map(b => (
            <span key={b.name} className="text-[10px] bg-muted rounded-full px-2 py-0.5 border border-border">
              {b.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
