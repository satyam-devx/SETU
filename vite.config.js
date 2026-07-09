// SETU — Vite Config
// base path is host-aware:
//   • VITE_BASE_PATH env (if set) wins — Cloudflare Pages / custom domain set "/"
//   • else "/SETU/" for production builds (GitHub Pages repo subdirectory)
//   • else "/" in dev (localhost)
// AuthContext reads import.meta.env.BASE_URL to build the OAuth callback URL.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH || (command === 'build' ? '/SETU/' : '/'),

  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        // NOTE: must be a function, not an object. Vite 8's default bundler
        // (rolldown) rejects the old object-map form ("manualChunks is not
        // a function") that plain Rollup used to accept; a function works
        // on both, so this is the portable form regardless of which
        // bundler resolves for a given install. See CHANGELOG.md.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (/node_modules\/(react|react-dom|react-router-dom)\//.test(id)) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@supabase/supabase-js')) {
            return 'supabase-vendor';
          }
          if (/node_modules\/(lucide-react|clsx|tailwind-merge)\//.test(id)) {
            return 'ui-vendor';
          }
          // Heavy, route-specific libs split into named, cacheable chunks.
          // framer-motion (role selector / animations) and recharts
          // (analytics pages only) shouldn't bloat the shared entry chunk.
          if (id.includes('node_modules/framer-motion')) {
            return 'motion-vendor';
          }
          if (id.includes('node_modules/recharts')) {
            return 'chart-vendor';
          }
          // Firebase is already dynamically import()'d inside useFcmToken.js
          // (only once a user opts into push notifications), so the bundler
          // already code-splits it out of the main bundle automatically.
          // Naming it here just gives it a stable, cacheable chunk name
          // instead of an auto-generated one — no behavioural change.
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            return 'firebase-vendor';
          }
          // NOTE: Leaflet and Mapbox GL are intentionally NOT npm
          // dependencies — src/lib/maps.js loads both from a CDN
          // (unpkg/Mapbox) at runtime via <script>/<link> injection,
          // specifically to keep them off the JS bundle entirely for 2G
          // users who never open a map screen. Do not re-add
          // `leaflet`/`react-leaflet`/`mapbox-gl` as npm dependencies —
          // see PERFORMANCE.md and CHANGELOG.md.
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },

  server: {
    port: 5173,
    host: true,
  },
}));
