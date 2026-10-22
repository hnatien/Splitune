import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Manual device-test page (`pnpm --filter @splitune/audio-engine demo`). AudioWorklet needs a
// secure context: localhost works; phones on the LAN need HTTPS in front (Tailscale serve, or
// Caddy + mkcert; docs/implementation/25-personal-mode.md).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { port: 5175 },
})
