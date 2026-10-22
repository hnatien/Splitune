import { registerServiceWorker } from './pwa'
import { startDeviceTelemetry } from './telemetry'

// Work that waits for the first render, loaded on demand so it stays outside the route budgets
// (10 §9): the service worker (pwa.ts) and the device's product events (telemetry.ts).
export function afterFirstRender(): void {
  registerServiceWorker()
  startDeviceTelemetry()
}
