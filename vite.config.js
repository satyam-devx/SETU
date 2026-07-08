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
        manualChunks: {
          'react-vendor':    ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-vendor':       ['lucide-react', 'clsx', 'tailwind-merge'],
          // Heavy, route-specific libs split into named, cacheable chunks.
          // framer-motion (role selector / animations) and recharts
          // (analytics pages only) shouldn't bloat the shared entry chunk.
          'motion-vendor':   ['framer-motion'],
          'chart-vendor':    ['recharts'],
          // Firebase is already dynamically import()'d inside useFcmToken.js
          // (only once a user opts into push notifications), so Rollup already
          // code-splits it out of the main bundle automatically. Naming it here
          // just gives it a stable, cacheable chunk name instead of an
          // auto-generated one — no behavioural change.
          'firebase-vendor': ['firebase/app', 'firebase/messaging'],
          // NOTE: Leaflet and Mapbox GL are intentionally NOT npm dependencies —
          // src/lib/maps.js loads both from a CDN (unpkg/Mapbox) at runtime via
          // <script>/<link> injection, specifically to keep them off the JS
          // bundle entirely for 2G users who never open a map screen. Do not
          // re-add `leaflet`/`react-leaflet`/`mapbox-gl` as npm dependencies —
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
