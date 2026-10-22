import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Serves the offline-render harness (test/browser/index.html) for the Playwright audio suite.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { port: 5174, strictPort: true },
  logLevel: 'warn',
})
