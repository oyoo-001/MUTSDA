import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 1. Fixes the 'exports is undefined' crash by transforming CJS to ESM
    commonjsOptions: {
      transformMixedEsModules: true, 
    },
    // 2. Remove manualChunks to fix the 'Circular chunk' warning from your logs
    rollupOptions: {
      external: ['https'], // Don't try to bundle Node's 'https' module
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});