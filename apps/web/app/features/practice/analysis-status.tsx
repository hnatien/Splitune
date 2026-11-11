import type { StageFailure } from '@/lib/reasons'
import type { PracticeData } from './model/data'

// Failures of the analysis the practice screen shows (banners for fallbacks, the failure card for a
// failed run): the live stream's, then any the analysis lists that the stream didn't. Kept light,
// in the route chunk; the Getting ready card itself loads on demand (getting-ready.tsx).
export function analysisFailures(data: PracticeData): StageFailure[] {
  return [
    ...data.live.failures,
    ...Object.entries(data.analysis.data?.stages ?? {})
      .filter(
        ([stage, state]) =>
          state.status === 'failed' && !data.live.failures.some((f) => f.stage === stage),
      )
      .map(([stage, state]) => ({ stage, errorCode: state.error_code })),
  ]
}
