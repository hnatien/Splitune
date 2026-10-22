import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { routeApiInProcess } from './lib/api-fetch.ts'
import { getApi } from './server/api.ts'
import { forwardToApi } from './server/forward.ts'
import { NONCE_HEADER, securityHeaders, storageSources } from './server/headers.ts'

// One Node server for the whole app (25-personal-mode.md §1): the Hono API answers /v1/* (oRPC,
// Better Auth, SSE) and /internal/* (health checks); everything else is TanStack Start.
const API_PATH = /^\/(?:v1|internal)(?:\/|$)/

routeApiInProcess(forwardToApi)

const storage = storageSources(process.env)
const { NODE_ENV, CSP_REPORT_ONLY } = process.env
const production = NODE_ENV === 'production'
const reportOnly = CSP_REPORT_ONLY === 'true'
const dev = import.meta.env.DEV

type NodeBindings = { runtime?: { node?: { req?: unknown; res?: unknown } } }

// Nitro hands over srvx's Request, which undici's Request constructor can't clone (Hono's body
// limit and Start both do); requests are rebuilt as plain ones first.
function plainRequest(request: Request, headers: Headers = request.headers): Request {
  return new Request(request.url, {
    method: request.method,
    headers,
    signal: request.signal,
    ...(request.body ? { body: request.body, duplex: 'half' } : {}),
  } as RequestInit)
}

function nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

export default createServerEntry({
  async fetch(request) {
    if (API_PATH.test(new URL(request.url).pathname)) {
      // Hono's getConnInfo reads the Node request for the client address (per-IP rate limits).
      const node = (request as NodeBindings).runtime?.node
      return getApi().fetch(plainRequest(request), { incoming: node?.req, outgoing: node?.res })
    }
    const value = nonce()
    const headers = new Headers(request.headers)
    headers.set(NONCE_HEADER, value)
    const response = await handler.fetch(plainRequest(request, headers))
    const secured = new Response(response.body, response)
    for (const [name, header] of Object.entries(
      securityHeaders({ nonce: value, storage, dev, production, reportOnly }),
    )) {
      secured.headers.set(name, header)
    }
    return secured
  },
})
