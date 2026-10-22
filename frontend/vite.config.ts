/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The 3D twin chunk (three.js) is ~1 MB but lazy-loaded only on the twin page.
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5080',
      '/assets3d': 'http://localhost:5080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
