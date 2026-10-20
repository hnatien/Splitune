import { z } from 'zod'
import { contracts } from '../registry.ts'

// Error codes of 04-api-contract.md plus the URL-import codes of 25-personal-mode.md §4.
export const ERROR_STATUS = {
  invalid_input: 400,
  unauthenticated: 401,
  analysis_cap_reached: 402,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  file_too_large: 413,
  too_long: 413,
  unsupported_media: 415,
  rights_warranty_required: 422,
  url_unsupported: 422,
  rate_limited: 429,
  taken_down: 451,
  url_download_failed: 502,
  pipeline_unavailable: 503,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

export const ErrorCode = z
  .enum(Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]])
  .register(contracts, { id: 'ErrorCode' })

export const AnalysisCapDetails = z.object({
  type: z.enum(['welcome', 'full', 'lite']),
  resets_at: z.iso.datetime().nullable(),
  upgrade_available: z.boolean(),
})

// `message` is user-safe; `details` is machine-readable (e.g. field issues for invalid_input,
// AnalysisCapDetails for analysis_cap_reached).
export const ErrorEnvelope = z
  .object({
    code: ErrorCode,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    retry_after_s: z.number().int().nonnegative().optional(),
  })
  .register(contracts, { id: 'ErrorEnvelope' })
