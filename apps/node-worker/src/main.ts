// `pnpm --filter @splitune/node-worker dev` on the Mac (25-personal-mode.md §5). Connects as the
// restricted node_worker role; SIGINT/SIGTERM stop claiming and finish the running job.
import { hostname } from 'node:os'
import { createDb } from '@splitune/db'
import { createStorage, storageConfigFromEnv } from '@splitune/storage'
import { configFromEnv } from './config.ts'
import { createLogger } from './log.ts'
import { loadViews } from './views.ts'
import { NodeWorker } from './worker.ts'

const config = configFromEnv()
const log = createLogger()
const db = createDb({ url: config.databaseUrl, max: 3, applicationName: 'splitune-node-worker' })
const storage = createStorage(storageConfigFromEnv())
const worker = new NodeWorker(
  {
    db,
    storage,
    views: loadViews(config.viewsPath),
    workerId: config.workerId,
    log,
    jobHeartbeatMs: config.jobHeartbeatMs,
  },
  config,
  hostname(),
)
await worker.start()
log.info('worker started', { worker_id: config.workerId })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log.info('stopping', { signal })
    worker
      .stop()
      .then(() => db.$client.end())
      .then(
        () => process.exit(0),
        () => process.exit(1),
      )
  })
}
