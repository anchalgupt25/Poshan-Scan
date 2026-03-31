import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Poshan Scan',
        short_name: 'Poshan',
        description: 'Know what is in every food pack your child eats',
        theme_color: '#C4622D',
        background_color: '#FAF3E8',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Cache product lookups for offline use
        runtimeCaching: [
          {
            urlPattern: /\/scan\/barcode\//,
            handler: 'CacheFirst',
            options: { cacheName: 'product-cache', expiration: { maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
        changeOrigin: true,
      },
    },
  },
});
