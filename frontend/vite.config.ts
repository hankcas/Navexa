import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  // Without the VITE_ prefix this value stays on the dev server and never reaches the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [react()],
    optimizeDeps: {
      // The map loads on demand, so Vite would find these libraries late and re-bundle them while
      // the page is open, mixing old and new copies. Bundling them at startup avoids it (dev only).
      include: ['leaflet', 'react-leaflet', 'react-leaflet-cluster'],
    },
    build: {
      // Small files are inlined as data: URIs by default, which the font-src 'self' CSP blocks.
      assetsInlineLimit: (filePath: string) => (filePath.endsWith('.woff2') ? false : undefined),
    },
    server: {
      // Mirrors the rewrites in vercel.json so local and production behave the same.
      proxy: {
        '/api/health': { target, changeOrigin: true, rewrite: () => '/health' },
        '/api': { target, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      // Vitest turns CSS imports into empty strings by default; the contrast test reads the real tokens.
      css: { include: [/tokens\.css/] },
    },
  }
})
