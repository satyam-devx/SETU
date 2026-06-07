import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // Required for GitHub Pages: assets are served at /SETU/assets/...
  // Without this, Vite builds paths as /assets/... which 404 on GitHub Pages.
  base: '/SETU/',

  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
