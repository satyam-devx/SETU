// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — MAPBOX HELPERS
// ═══════════════════════════════════════════════════════════

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export const MADHEPUR_CENTER = [86.070, 26.350]; // [lng, lat]
export const BIHAR_BOUNDS = [
  [83.3, 24.3], // Southwest
  [88.3, 27.5]  // Northeast
];

/**
 * Static coordinates for villages
 */
export const VILLAGE_COORDINATES = {
  'Madhepur': { lat: 26.350, lng: 86.070 },
  'Darbhanga': { lat: 26.150, lng: 85.900 },
  'Madhubani': { lat: 26.350, lng: 86.080 },
  'Sakri': { lat: 26.210, lng: 86.080 },
  'Jhanjharpur': { lat: 26.260, lng: 86.270 },
};

/**
 * Graceful script loader for Mapbox GL JS
 */
export async function loadMapbox() {
  if (window.mapboxgl) return window.mapboxgl;

  return new Promise((resolve, reject) => {
    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
    document.head.appendChild(link);

    // JS
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
    script.onload = () => {
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      resolve(window.mapboxgl);
    };
    script.onerror = () => reject(new Error('Mapbox failed to load'));
    document.body.appendChild(script);
  });
}

/**
 * Calculate ETA (Rural Bihar constants)
 */
export function calculateETA(distanceInKm) {
  const avgSpeedKmH = 20; // 20km/h for rural roads
  const timeHours = distanceInKm / avgSpeedKmH;
  const timeMinutes = Math.round(timeHours * 60) + 5; // +5 mins for turns
  return timeMinutes;
}

/**
 * Haversine distance
 */
export function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
