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
}
