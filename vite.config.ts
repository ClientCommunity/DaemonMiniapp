import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Node process environment typing for Vite config
declare const process: { env?: Record<string, string | undefined> };

// https://vite.dev/config/
const basePath =
  (typeof process !== 'undefined' && process.env?.VITE_BASE_PATH) ||
  (typeof process !== 'undefined' && process.env?.RENDER ? '/' : '/DaemonMiniapp/');

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: (typeof process !== 'undefined' && process.env?.VITE_BACKEND_URL) || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
