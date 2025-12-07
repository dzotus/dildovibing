import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Base path for GitHub Pages:
  // - в локальной разработке будет '/'
  // - на GitHub Pages берётся из переменной окружения VITE_BASE_PATH (см. .github/workflows/deploy.yml)
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 3929,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  optimizeDeps: {
    force: true, // Принудительная переоптимизация зависимостей
  }
});