// SETU — Vite Config
// base is '/SETU/' in production builds (GitHub Pages repo subdirectory)
// and '/' in dev (localhost).
// AuthContext reads import.meta.env.BASE_URL to build the OAuth callback URL.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/SETU/' : '/',

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
