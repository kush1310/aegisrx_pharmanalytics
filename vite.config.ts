import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          logLevel: 'silent',
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                // Native / heavy deps — loaded from node_modules at runtime
                'better-sqlite3',
                'electron',
                '@hono/node-server',
                'xlsx',
                'pdf-parse',
              ]
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          logLevel: 'silent',
          build: { outDir: 'dist-electron' }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages':      path.resolve(__dirname, './src/pages'),
      '@stores':     path.resolve(__dirname, './src/stores'),
      '@api':        path.resolve(__dirname, './src/api'),
      '@types':      path.resolve(__dirname, './src/types'),
    }
  },
  build: {
    outDir:     'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  }
});
