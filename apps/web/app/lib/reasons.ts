import type { ErrorCode } from '@splitune/contracts'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'

// Machine codes → catalogue copy (27 §5.6). The UI renders by code only; unknown codes fall back
// to analysis.failed. The pipeline codes are the list of step 09 (PROGRESS.md "Machine codes").

/** Copy for a fallback the analysis took instead of a failed stage (stage.failed.fallback). */
const FALLBACKS: Record<string, () => string> = {
  stems_unavailable: () => m['analysis.stems_unavailable'](),
  tagger_unavailable: () => m['analysis.reason.tagger_unavailable'](),
  chords_unavailable: () => m['analysis.reason.chords_unavailable'](),
  notes_unavailable: () => m['practice.reason.notes_unavailable'](),
  notes_on_mixture: () => m['analysis.reason.notes_on_mixture'](),
  beats_cpu_small: () => m['analysis.reason.beats_fallback'](),
  beats_mps_failed: () => m['analysis.reason.beats_fallback'](),
  separation_fallback_model: () => m['analysis.reason.separation_fallback'](),
  video_unavailable: () => m['analysis.reason.video_unavailable'](),
}

/** Copy for an error code that ends a stage (or the analysis) without a fallback. */
const FAILURES: Record<string, () => string> = {
  queued_waiting_for_worker: () => m['analysis.queued_offline'](),
  url_unsupported: () => m['import.url_unsupported'](),
  url_download_failed: () => m['import.url_failed'](),
  too_long: () => m['analysis.reason.too_long'](),
  file_too_large: () => m['import.too_large'](),
  input_too_large: () => m['import.too_large'](),
  unsupported_media: () => m['import.unreadable'](),
  decode_failed: () => m['import.unreadable'](),
  decode_timeout: () => m['import.unreadable'](),
  audio_empty: () => m['analysis.reason.audio_empty'](),
  beats_not_found: () => m['analysis.reason.beats_not_found'](),
  ...FALLBACKS,
}

// When a stage fails without naming a fallback, what the pipeline does instead (06 §6).
const STAGE_FALLBACK: Record<string, string> = {
  tag: 'tagger_unavailable',
  separate: 'stems_unavailable',
  stem_post: 'stems_unavailable',
  chords: 'chords_unavailable',
}

export type StageFailure = { stage: string; errorCode?: string | undefined; fallback?: string }

/** One sentence for a failed stage, in the 27 §5.4 formula's "what happened" slot. */
export function stageFailureMessage({ stage, errorCode, fallback }: StageFailure): string {
  const implied =
    fallback ??
    STAGE_FALLBACK[stage] ??
    (stage.startsWith('notes.') ? 'notes_unavailable' : undefined)
  const fromFallback = implied ? FALLBACKS[implied] : undefined
  if (fromFallback) return fromFallback()
  const fromCode = errorCode ? FAILURES[errorCode] : undefined
  return fromCode ? fromCode() : m['analysis.failed']()
}

/** Whether a failure leaves a usable (partial) analysis rather than ending it. */
export function isFallback({ stage, fallback }: StageFailure): boolean {
  return Boolean(fallback) || stage in STAGE_FALLBACK || stage.startsWith('notes.')
}

/** Copy for an API error (ErrorEnvelope code, 27 §5.6 "Codes from the contracts"). */
export function apiErrorMessage(
  code: ErrorCode | undefined,
  data: Record<string, unknown> = {},
): string {
  const { type, limit, resets_at, retry_after_s } = data
  switch (code) {
    case 'invalid_input':
      return m['error.invalid_input']()
    case 'unauthenticated':
      return m['error.unauthenticated']()
    case 'forbidden':
    case 'not_found':
      return m['error.not_found']()
    case 'conflict':
      return m['error.conflict']()
    case 'file_too_large':
      return m['import.too_large']()
    case 'too_long':
      return m['analysis.reason.too_long']()
    case 'unsupported_media':
      return m['import.unreadable']()
    case 'url_unsupported':
      return m['import.url_unsupported']()
    case 'url_download_failed':
      return m['import.url_failed']()
    case 'analysis_cap_reached':
      return type === 'lite'
        ? m['plan.cap_lite']({
            // The cap comes from /v1/me (callers merge it in); the details carry the reset.
            limit: String(limit ?? ''),
            date: typeof resets_at === 'string' ? formatDate(new Date(resets_at)) : '',
          })
        : m['plan.cap_full']()
    case 'rate_limited':
      return m['error.rate_limited']({ seconds: String(retry_after_s ?? 60) })
    case 'pipeline_unavailable':
      return m['analysis.queued_offline']()
    default:
      return m['system.error']()
  }
}
