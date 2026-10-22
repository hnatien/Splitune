import { createTracker } from '@splitune/analytics'
import { CSRF_HEADER } from '@/lib/api'

// Product events (16 §2) to POST /v1/events, batched by the typed tracker. keepalive lets the
// last batch outlive the page; what's queued is sent when the page is hidden.
export const analytics = createTracker({
  send: async (events) => {
    const response = await fetch('/v1/events', {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', [CSRF_HEADER]: '1' },
      body: JSON.stringify({ events }),
    })
    if (!response.ok) throw new Error(`POST /v1/events answered ${response.status}`)
  },
})

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void analytics.flush()
  })
}
