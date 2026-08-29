import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// spec §1 (React 18 + Vite + TS), spec §9 (PWA)
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Manhwa Library',
        short_name: 'Manhwa',
        description: 'Library manhwa/manga pribadi — local-first, offline.',
        lang: 'id',
        theme_color: '#111214', // design §2 bg
        background_color: '#111214',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['books', 'entertainment', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // SPA: seluruh rute (/library, /title/:id, …) dilayani index.html dari
        // cache supaya deep-link tetap jalan offline — req FR-27, spec §9.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // jszip di-load on-demand; tetap di-precache agar restore bisa offline.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // fake-indexeddb jauh lebih lambat dari IndexedDB asli; test pipeline
    // meng-commit 118 judul beberapa kali sehingga butuh margin lebih.
    testTimeout: 30_000,
  },
} as Parameters<typeof defineConfig>[0]);
