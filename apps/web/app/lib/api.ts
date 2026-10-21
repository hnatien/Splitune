import { createORPCClient, ORPCError } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { contract, type ErrorCode, ErrorEnvelope } from '@splitune/contracts'
import { apiFetch } from '@/lib/api-fetch'

// oRPC client over the contract (10 §3: TanStack Query wraps it). In the browser it calls the
// same origin with the session cookie and the CSRF header the API requires on mutations
// (17-security.md §5); during SSR it calls the in-process API with the visitor's cookie.

export const CSRF_HEADER = 'x-splitune-csrf'

const link = new OpenAPILink(contract, {
  url: () => (typeof window === 'undefined' ? 'http://splitune.internal' : window.location.origin),
  headers: () => ({ [CSRF_HEADER]: '1' }),
  fetch: (request, init) => apiFetch(new Request(request, { ...init, credentials: 'same-origin' })),
  // The API answers errors with the ErrorEnvelope (04 "Errors"), not oRPC's own error body.
  customErrorResponseBodyDecoder: (body, response) => {
    const parsed = ErrorEnvelope.safeParse(body)
    if (!parsed.success) return null
    const { code, message, details, retry_after_s } = parsed.data
    return new ORPCError(code, {
      status: response.status,
      message,
      data: retry_after_s === undefined ? details : { ...details, retry_after_s },
    })
  },
})

export type ApiClient = ContractRouterClient<typeof contract>

export const client: ApiClient = createORPCClient(link)
export const orpc = createTanstackQueryUtils(client)

/** The contract error code of a failed call, if it was one (27 §5.6 maps codes to copy). */
export function errorCode(error: unknown): ErrorCode | undefined {
  return error instanceof ORPCError && typeof error.code === 'string'
    ? (error.code as ErrorCode)
    : undefined
}

export function errorData(error: unknown): Record<string, unknown> {
  return error instanceof ORPCError && error.data && typeof error.data === 'object'
    ? (error.data as Record<string, unknown>)
    : {}
}
