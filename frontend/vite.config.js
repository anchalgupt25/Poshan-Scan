import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server runs on 5173 (matches FastAPI CORS allow-list).
// All /api/* calls are proxied to the FastAPI backend on :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
