import { usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Better Auth is mounted by the API at /v1/auth (apps/api/src/auth.ts); the browser talks to it
// on the same origin, so the session cookie is first-party.
export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? 'http://splitune.internal' : window.location.origin,
  basePath: '/v1/auth',
  plugins: [usernameClient()],
})

// apps/api/src/auth.ts USERNAME_* and PASSWORD_MIN_LENGTH; the server checks them again.
export const USERNAME_MIN = 3
export const USERNAME_MAX = 30
export const PASSWORD_MIN = 8
