import { ORPCError, ValidationError } from '@orpc/server'
import { ERROR_STATUS, type ErrorCode, type ErrorEnvelope } from '@splitune/contracts'
import type { z } from 'zod'

type Envelope = z.infer<typeof ErrorEnvelope>

// User-safe default messages; handlers may pass a more specific one.
const MESSAGES: Record<ErrorCode, string> = {
  invalid_input: 'The request is not valid.',
  unauthenticated: 'Please sign in.',
  analysis_cap_reached: 'You have used all analyses of this type for now.',
  forbidden: 'You cannot do that.',
  not_found: 'Not found.',
  conflict: 'This conflicts with the current state.',
  file_too_large: 'The file or request is too large.',
  too_long: 'The song is too long.',
  unsupported_media: 'This file type is not supported.',
  rights_warranty_required: 'Please confirm you have the right to use this file.',
  url_unsupported: 'This URL cannot be imported.',
  rate_limited: 'Too many requests. Please try again later.',
  taken_down: 'This song has been removed.',
  internal_error: 'Something went wrong on our side.',
  url_download_failed: 'The download failed.',
  pipeline_unavailable: 'Processing is unavailable right now. Please try again later.',
}

const isErrorCode = (code: string): code is ErrorCode => Object.hasOwn(ERROR_STATUS, code)

// Throws a contract error: the status comes from ERROR_STATUS, the envelope from toEnvelope().
export function apiError(
  code: ErrorCode,
  options: { message?: string; details?: Record<string, unknown> } = {},
): ORPCError<ErrorCode, Record<string, unknown> | undefined> {
  return new ORPCError<ErrorCode, Record<string, unknown> | undefined>(code, {
    status: ERROR_STATUS[code],
    message: options.message ?? MESSAGES[code],
    ...(options.details ? { data: options.details } : {}),
  })
}

// oRPC's own errors (BAD_REQUEST for malformed or invalid input, INTERNAL_SERVER_ERROR, …) carry
// the right HTTP status; their code is translated so clients only ever see contract codes.
function codeFor(error: ORPCError<string, unknown>): ErrorCode {
  if (isErrorCode(error.code)) return error.code
  switch (error.status) {
    case 401:
      return 'unauthenticated'
    case 403:
      return 'forbidden'
    case 404:
    case 405:
      return 'not_found'
    case 409:
      return 'conflict'
    case 413:
      return 'file_too_large'
    case 415:
      return 'unsupported_media'
    case 429:
      return 'rate_limited'
    default:
      return error.status >= 500 ? 'internal_error' : 'invalid_input'
  }
}

interface Issue {
  message: string
  path?: readonly (PropertyKey | { key: PropertyKey })[] | undefined
}

const issuePath = (issue: Issue) =>
  (issue.path ?? []).map((p) => String(typeof p === 'object' ? p.key : p)).join('.')

// The body of every error response (04-api-contract.md "Error codes").
export function toEnvelope(error: ORPCError<string, unknown>): Envelope {
  const code = codeFor(error)
  const envelope: Envelope = { code, message: MESSAGES[code] }
  if (code === 'invalid_input' && error.cause instanceof ValidationError) {
    envelope.details = {
      issues: (error.cause.issues as readonly Issue[]).map((issue) => ({
        path: issuePath(issue),
        message: issue.message,
      })),
    }
    return envelope
  }
  // oRPC's own messages can mention internals; only contract errors raised by our handlers keep
  // theirs.
  if (isErrorCode(error.code)) envelope.message = error.message || MESSAGES[code]
  const data = error.data as ({ retry_after_s?: unknown } & Record<string, unknown>) | undefined
  if (code === 'rate_limited' && typeof data?.retry_after_s === 'number') {
    envelope.retry_after_s = data.retry_after_s
  } else if (data && typeof data === 'object' && code !== 'internal_error') {
    envelope.details = data
  }
  return envelope
}

export function envelopeResponse(
  code: ErrorCode,
  options: { message?: string; details?: Record<string, unknown>; retryAfterS?: number } = {},
): Response {
  const body: Envelope = { code, message: options.message ?? MESSAGES[code] }
  if (options.details) body.details = options.details
  const headers = new Headers({ 'content-type': 'application/json' })
  if (options.retryAfterS !== undefined) {
    body.retry_after_s = options.retryAfterS
    headers.set('retry-after', String(options.retryAfterS))
  }
  return new Response(JSON.stringify(body), { status: ERROR_STATUS[code], headers })
}
