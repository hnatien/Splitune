import type { AudioStats } from './audio-stats'

// Pre-flight checks (13 §2 step 3) on the local decode. Limits block the import; warnings only
// set expectations (results may be rougher) and never stop it.

export const MAX_DURATION_S = 20 * 60
export const MAX_BYTES = 500 * 1024 * 1024

export type PreflightIssue =
  | { kind: 'too_long'; durationS: number }
  | { kind: 'too_large' }
  | { kind: 'quiet' }
  | { kind: 'clipping' }
  | { kind: 'mostly_silent' }

const QUIET_DB = -35
const CLIPPED_MAX = 0.001
const SILENT_MAX = 0.5

export function preflight(bytes: number, stats: AudioStats | undefined): PreflightIssue[] {
  const issues: PreflightIssue[] = []
  if (bytes > MAX_BYTES) issues.push({ kind: 'too_large' })
  if (!stats) return issues
  if (stats.durationS > MAX_DURATION_S)
    issues.push({ kind: 'too_long', durationS: stats.durationS })
  if (stats.silentFraction > SILENT_MAX) issues.push({ kind: 'mostly_silent' })
  else if (stats.rmsDb < QUIET_DB) issues.push({ kind: 'quiet' })
  if (stats.clippedFraction > CLIPPED_MAX) issues.push({ kind: 'clipping' })
  return issues
}

export const isBlocking = (issue: PreflightIssue) =>
  issue.kind === 'too_long' || issue.kind === 'too_large'
