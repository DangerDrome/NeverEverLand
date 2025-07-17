import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 8000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@tiles': resolve(__dirname, './src/tiles'),
      '@ui': resolve(__dirname, './src/ui'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});