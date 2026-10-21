import { magicLinkClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Better Auth is mounted by the API at /v1/auth (apps/api/src/auth.ts); the browser talks to it
// on the same origin, so the session cookie is first-party.
export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? 'http://splitune.internal' : window.location.origin,
  basePath: '/v1/auth',
  plugins: [magicLinkClient()],
})

// apps/api/src/auth.ts MAGIC_LINK_TTL_S, in minutes, for "It works for {minutes} minutes".
export const MAGIC_LINK_MINUTES = 5
