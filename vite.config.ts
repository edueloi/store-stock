import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Only cache PDV assets — leave admin/store untouched
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: '/index.html',
          navigateFallbackAllowlist: [/^\/pdv/],
          globPatterns: ['**/*.{js,css,html,png,jpg,svg,ico,woff2}'],
          // exclude heavy chunks that exceed 2 MB workbox limit
          globIgnores: [
            '**/exceljs-*.js',
            '**/jspdf-*.js',
            '**/recharts-*.js',
            '**/pdf-*.js',
            '**/logo-boxsys-vazado.png',
          ],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
          runtimeCaching: [
            {
              urlPattern: /^\/api\/products/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pdv-products',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 500, maxAgeSeconds: 300 },
              },
            },
          ],
        },
        manifest: {
          name: 'BoxSys PDV',
          short_name: 'PDV',
          description: 'Terminal de Vendas BoxSys',
          start_url: '/pdv',
          scope: '/pdv',
          display: 'standalone',
          orientation: 'landscape',
          background_color: '#0f172a',
          theme_color: '#0f172a',
          lang: 'pt-BR',
          icons: [
            { src: '/system/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/system/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Stable named chunks for heavy libs — avoids hash-mismatch 404s on deploy
          manualChunks(id) {
            if (id.includes('node_modules/jspdf')) return 'jspdf';
            if (id.includes('node_modules/exceljs')) return 'exceljs';
            if (id.includes('node_modules/recharts')) return 'recharts';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
