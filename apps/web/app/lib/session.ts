import type { Me } from '@splitune/contracts'
import { queryOptions } from '@tanstack/react-query'
import type { z } from 'zod'
import { apiFetch } from '@/lib/api-fetch'

export type MeData = z.infer<typeof Me>

// The signed-in user, or null. Shared by the session-aware shells and the route guards, so it is
// a bare fetch: every page (marketing included) loads it, and the oRPC client and its contract
// schemas stay out of the landing page's bundle (10 §9). The API validates the body against `Me`.
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async ({ signal }): Promise<MeData | null> => {
    const origin =
      typeof window === 'undefined' ? 'http://splitune.internal' : window.location.origin
    const response = await apiFetch(
      new Request(`${origin}/v1/me`, { signal, credentials: 'same-origin' }),
    )
    if (response.status === 401) return null
    if (!response.ok) throw new Error(`GET /v1/me answered ${response.status}`)
    return (await response.json()) as MeData
  },
  staleTime: 60_000,
})
