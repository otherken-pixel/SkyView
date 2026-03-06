import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
})();

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.weather\.gov\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https:\/\/aviationweather\.gov\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'aviation-wx-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
      manifest: false, // using public/manifest.json
    }),
  ],
  build: {
    outDir: 'dist',
  },
  define: {
    __BUILD_COMMIT__: JSON.stringify(commitHash),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
