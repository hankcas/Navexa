import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  // Without the VITE_ prefix this value stays on the dev server and never reaches the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [react()],
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
