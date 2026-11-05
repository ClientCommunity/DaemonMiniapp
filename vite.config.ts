import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Node process environment typing for Vite config
declare const process: { env?: Record<string, string | undefined> };

// https://vite.dev/config/
const basePath =
  (typeof process !== 'undefined' && process.env?.VITE_BASE_PATH) ||
  (typeof process !== 'undefined' && process.env?.RENDER ? '/' : '/DaemonMiniapp/');

const buildVersion = Date.now().toString();

export default defineConfig({
  base: basePath,
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    {
      name: 'generate-version-file',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({
            version: buildVersion,
            builtAt: new Date().toISOString()
          }, null, 2)
        });
      }
    }
  ],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: (typeof process !== 'undefined' && process.env?.VITE_BACKEND_URL) || 'https://fahhh.duckdns.org',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
