/** @format */

import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/events': 'http://127.0.0.1:3000',
      '/project': 'http://127.0.0.1:3000',
    },
  },
});
