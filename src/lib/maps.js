// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — MAP HELPERS
//
// TWO map libraries in use:
//  - Leaflet   : customer-facing tracking (no API key required)
//  - Mapbox GL : rider navigation + village map (richer, requires key)
//
// Both are loaded lazily from CDN so bundle size stays small.
// ═══════════════════════════════════════════════════════════

// ── Shared constants ──────────────────────────────────────
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const MADHEPUR_CENTER = [86.070, 26.350]; // [lng, lat]
export const BIHAR_BOUNDS = [
  [83.3, 24.3], // Southwest
  [88.3, 27.5], // Northeast
];

export const VILLAGE_COORDINATES = {
  'Madhepur':    { lat: 26.350, lng: 86.070 },
  'Darbhanga':   { lat: 26.150, lng: 85.900 },
  'Madhubani':   { lat: 26.350, lng: 86.080 },
  'Sakri':       { lat: 26.210, lng: 86.080 },
  'Jhanjharpur': { lat: 26.260, lng: 86.270 },
};

// ── Leaflet (customer-facing, no API key) ─────────────────
const LEAFLET_VERSION = '1.9.4';

/**
 * Lazily load Leaflet from CDN and return the `L` global.
 * Safe to call multiple times — resolves immediately if already loaded.
 */
export async function initLeaflet() {
  if (window.L) return window.L;

  return new Promise((resolve, reject) => {
    // CSS
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link');
      link.id   = 'leaflet-css';
      link.rel  = 'stylesheet';
      link.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
      document.head.appendChild(link);
    }

    // Fix default marker icon path broken by bundlers
    // (leaflet assumes its images are relative to leaflet.css)
    const fixIcons = () => {
      // eslint-disable-next-line no-undef
      delete L.Icon.Default.prototype._getIconUrl;
      // eslint-disable-next-line no-undef
      L.Icon.Default.mergeOptions({
        iconUrl:       `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/marker-icon.png`,
        iconRetinaUrl: `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/marker-icon-2x.png`,
        shadowUrl:     `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/images/marker-shadow.png`,
      });
    };

    // JS
    if (!document.querySelector('#leaflet-js')) {
      const script  = document.createElement('script');
      script.id     = 'leaflet-js';
      script.src    = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
      script.onload = () => { fixIcons(); resolve(window.L); };
      script.onerror = () => reject(new Error('Leaflet failed to load'));
      document.body.appendChild(script);
    } else {
      // Script tag already added by a previous call — wait for it
      const wait = setInterval(() => {
        if (window.L) { clearInterval(wait); fixIcons(); resolve(window.L); }
      }, 50);
    }
  });
}

// ── Mapbox GL (rider navigation + village map) ────────────
/**
 * Lazily load Mapbox GL JS from CDN.
 * Requires VITE_MAPBOX_TOKEN env var to be set.
 */
export async function loadMapbox() {
  if (window.mapboxgl) return window.mapboxgl;

  return new Promise((resolve, reject) => {
    // CSS
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
    document.head.appendChild(link);

    // JS
    const script  = document.createElement('script');
    script.src    = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
    script.onload = () => {
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      resolve(window.mapboxgl);
    };
    script.onerror = () => reject(new Error('Mapbox failed to load'));
    document.body.appendChild(script);
  });
}

// ── Shared utilities ──────────────────────────────────────

/**
 * Haversine distance between two lat/lng points (kilometres).
 */
export function getDistance(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * ETA estimate in minutes (tuned for rural Bihar roads, ~20 km/h avg).
 */
export function calculateETA(distanceInKm) {
  const timeMinutes = Math.round((distanceInKm / 20) * 60) + 5; // +5 min buffer
  return timeMinutes;
}
