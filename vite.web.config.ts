import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
      '@components': path.resolve(process.cwd(), './src/components'),
      '@pages':      path.resolve(process.cwd(), './src/pages'),
      '@stores':     path.resolve(process.cwd(), './src/stores'),
      '@api':        path.resolve(process.cwd(), './src/api'),
      '@types':      path.resolve(process.cwd(), './src/types'),
    }
  },
  server: {
    port: 5174
  }
});
