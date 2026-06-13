// SETU — Vite Config
// BASE_URL is set to '/SETU/' in production (GitHub Pages) and '/' in dev.
// AuthContext reads import.meta.env.BASE_URL to build the OAuth callback URL,
// so redirectTo correctly becomes:
//   DEV:        http://localhost:5173/auth/callback
//   PROD:       https://user.github.io/SETU/auth/callback
// This was the #3 bug preventing Google OAuth on GitHub Pages.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => ({
  base: '/',

  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':    ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-vendor':       ['lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Warn if any chunk is over 500kb
    chunkSizeWarningLimit: 500,
  },

  server: {
    port: 5173,
    // Allow ngrok / local tunnel for mobile device testing
    host: true,
  },
}));
