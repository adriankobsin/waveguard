import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  logLevel: 'error',

  server: {
    host: '0.0.0.0',
    allowedHosts: true,

    proxy: {
      '/api': {
        target: process.env.VITE_SCANNER_URL || 'http://localhost:3002',
        changeOrigin: true,
      },
      '/chat': {
        target: process.env.VITE_SCANNER_URL || 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },

  // Same LAN binding for `npm run preview` / shipboard smoke tests
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: Number(process.env.WAVEGUARD_PREVIEW_PORT || 4173),
  },

  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});
