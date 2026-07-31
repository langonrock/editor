import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Tauri drives the dev server, so the port is fixed and a failure to bind must
 * be loud: a silent fallback port would leave the window pointing at nothing.
 */
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  },
  build: {
    target: 'esnext',
    sourcemap: true
  }
})
