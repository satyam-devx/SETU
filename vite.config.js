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
