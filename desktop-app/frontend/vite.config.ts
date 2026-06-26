import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/jobhit/',
  build: {
    outDir: '../backend/public',
    emptyOutDir: true
  },
  server: {
    port: 3000,
    proxy: {
      '/jobhit/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/jobhit/screenshots': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
});
