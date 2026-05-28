import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copy pdfjs worker to dist so it's served locally (no CDN dependency)
      {
        name: 'copy-pdfjs-worker',
        closeBundle() {
          try {
            mkdirSync('dist/assets', { recursive: true });
            copyFileSync(
              path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.mjs'),
              'dist/assets/pdf.worker.mjs'
            );
          } catch { /* ignore if file doesn't exist yet */ }
        },
      },
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
