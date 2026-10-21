import { z } from 'zod'
import { StageName } from '../analysis/stage.ts'

export const RunnerStatus = z.object({
  online: z.boolean(),
  last_heartbeat_at: z.iso.datetime().nullable(),
})

// Mac worker presence (25-personal-mode.md §5): a runner is online when one of its workers wrote a
// heartbeat within the last 2 minutes. `online` = every runner the pipeline needs is online.
export const WorkerStatus = z.object({
  online: z.boolean(),
  runners: z.object({ python: RunnerStatus, node: RunnerStatus }),
})

// Median wall-clock time of each stage over its recent successful runs, for the progress UI's
// honest ETA (13-import-onboarding-and-youtube-embed.md §4: never a fake progress bar). Stages
// without recent runs are absent; the client then shows no estimate for them.
export const StageTiming = z.object({
  stage: StageName,
  median_s: z.number().nonnegative(),
  runs: z.number().int().positive(),
})

export const SystemStats = z.object({ stages: z.array(StageTiming) })
