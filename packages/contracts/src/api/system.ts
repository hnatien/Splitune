import { z } from 'zod'

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
