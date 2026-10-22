import { type ClientLink, createORPCClient, ORPCError } from '@orpc/client'
import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { contract, type ErrorCode, ErrorEnvelope } from '@splitune/contracts'
import { apiFetch } from '@/lib/api-fetch'

// oRPC client over the contract (10 §3: TanStack Query wraps it). In the browser it calls the
// same origin with the session cookie and the CSRF header the API requires on mutations
// (17-security.md §5); during SSR it calls the in-process API with the visitor's cookie.

export const CSRF_HEADER = 'x-splitune-csrf'

function openApiLink<T extends AnyContractRouter>(router: T) {
  return new OpenAPILink(router, {
    url: () =>
      typeof window === 'undefined' ? 'http://splitune.internal' : window.location.origin,
    headers: () => ({ [CSRF_HEADER]: '1' }),
    fetch: (request, init) =>
      apiFetch(new Request(request, { ...init, credentials: 'same-origin' })),
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
}

const network = openApiLink(contract)

export type ApiClient = ContractRouterClient<typeof contract>

/**
 * Procedures answered on the device instead of by the API: a visitor's example song before they
 * have an account (13 §1). The practice screen reads it through the same client and queries.
 */
export interface LocalProcedures {
  handles(path: readonly string[], input: unknown): boolean
  /** `api` reaches the API itself, for what the device can't answer alone (signed URLs). */
  call(path: readonly string[], input: unknown, api: ApiClient): Promise<unknown>
}

let local: LocalProcedures | undefined

export function answerLocally(procedures: LocalProcedures | undefined) {
  local = procedures
}

/** Whether a call is answered on the device (so code that bypasses the client can skip it). */
export function answeredLocally(path: readonly string[], input: unknown): boolean {
  return local?.handles(path, input) ?? false
}

const networkClient: ApiClient = createORPCClient(network)

const link: ClientLink<Record<never, never>> = {
  call: (path, input, options) =>
    local?.handles(path, input)
      ? local.call(path, input, networkClient)
      : network.call(path, input, options),
}

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

/** A client for a contract that only some pages load (billing), with the same link settings. */
export const clientFor = <T extends AnyContractRouter>(router: T): ContractRouterClient<T> =>
  createORPCClient(openApiLink(router))
