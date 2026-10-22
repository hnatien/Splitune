// `pnpm --filter @splitune/node-worker dev` on the Mac (25-personal-mode.md §5). Connects as the
// restricted node_worker role; with NODE_WORKER_MAINTENANCE_DATABASE_URL it also logs in as
// maintenance for the lifecycle scheduler and privacy jobs (15 §3–§4). SIGINT/SIGTERM stop
// claiming and finish the running job.
import { hostname } from 'node:os'
import { userHasher } from '@splitune/analytics/server'
import { startTracing } from '@splitune/analytics/tracing'
import { createDb } from '@splitune/db'
import { createStorage, storageConfigFromEnv } from '@splitune/storage'
import { configFromEnv } from './config.ts'
import { lifecycleJobs } from './lifecycle.ts'
import { createLogger } from './log.ts'
import { Scheduler } from './scheduler.ts'
import { loadViews } from './views.ts'
import { NodeWorker } from './worker.ts'

const config = configFromEnv()
const log = createLogger()
const tracing = await startTracing('splitune-node-worker')
const db = createDb({ url: config.databaseUrl, max: 3, applicationName: 'splitune-node-worker' })
const storage = createStorage(storageConfigFromEnv())
const hashUser = config.analyticsSalt ? userHasher(config.analyticsSalt) : undefined
const { lifecycle } = config
const maintenance = lifecycle
  ? createDb({ url: lifecycle.maintenanceUrl, max: 2, applicationName: 'splitune-lifecycle' })
  : undefined
const worker = new NodeWorker(
  {
    db,
    storage,
    views: loadViews(config.viewsPath),
    workerId: config.workerId,
    log,
    jobHeartbeatMs: config.jobHeartbeatMs,
    ...(hashUser ? { hashUser } : {}),
    ...(lifecycle && maintenance && hashUser
      ? {
          privacy: {
            db,
            maintenance,
            storage,
            log,
            workerId: config.workerId,
            config: lifecycle,
            hashUser,
          },
        }
      : {}),
  },
  config,
  hostname(),
  lifecycle && maintenance
    ? new Scheduler(
        maintenance,
        lifecycleJobs({ maintenance, storage, log, config: lifecycle }),
        log,
      )
    : undefined,
)
await worker.start()
log.info('worker started', {
  worker_id: config.workerId,
  lifecycle: lifecycle !== undefined,
  analytics: hashUser !== undefined,
  tracing,
})
if (!lifecycle) log.warn('lifecycle jobs off: NODE_WORKER_MAINTENANCE_DATABASE_URL is not set')

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log.info('stopping', { signal })
    worker
      .stop()
      .then(() => Promise.all([db.$client.end(), maintenance?.$client.end()]))
      .then(
        () => process.exit(0),
        () => process.exit(1),
      )
  })
}
