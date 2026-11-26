import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  return {
    base: mode === 'gh-pages' ? '/sigma-ai/' : '/',
    plugins: [
      react(),
      tailwindcss(),
      ...(mode === 'gh-pages'
        ? [
            {
              name: 'strip-local-firebase-config-on-gh-pages',
              enforce: 'pre' as const,
              resolveId(id: string) {
                if (id.includes('firebase-applet-config.json')) {
                  return '\0empty-firebase-config';
                }
              },
              load(id: string) {
                if (id === '\0empty-firebase-config') {
                  return 'export default null;';
                }
              },
            },
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/three/')) return 'vendor-three';
            if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase';
            if (id.includes('/@fortawesome/')) return 'vendor-icons';
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/motion/')) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
