import { queue } from '@splitune/db'
import { authed } from '../procedures.ts'

const iso = (date: Date | null) => (date ? date.toISOString() : null)

export const system = {
  // Mac worker presence (25 §5): the UI shows "processing machine offline" while it is false.
  workerStatus: authed.system.workerStatus.handler(async ({ context }) => {
    const presence = await queue.workerPresence(context.deps.db)
    const runners = {
      python: {
        online: presence.python.online,
        last_heartbeat_at: iso(presence.python.lastHeartbeatAt),
      },
      node: { online: presence.node.online, last_heartbeat_at: iso(presence.node.lastHeartbeatAt) },
    }
    return { online: runners.python.online && runners.node.online, runners }
  }),

  // Recent median stage times for the progress UI's ETA (13 §4); aggregates over every user's
  // runs, never per-user data.
  stats: authed.system.stats.handler(async ({ context }) => {
    const timings = await queue.stageTimings(context.deps.db)
    return {
      stages: timings.map((t) => ({ stage: t.stage, median_s: t.medianS, runs: t.runs })),
    }
  }),
}
