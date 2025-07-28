import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 8007,
    open: true
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true
  }
});