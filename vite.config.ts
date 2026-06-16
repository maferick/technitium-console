import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, proxy /api to the Technitium server so the SPA is same-origin.
// In prod, nginx does the proxying (see nginx.conf).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: process.env.TECHNITIUM_DEV_PROXY || 'http://localhost:5380', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
})
