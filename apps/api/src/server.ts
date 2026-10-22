// Standalone API server (`pnpm --filter @splitune/api dev:standalone`): the same Hono app the web
// server (apps/web, `pnpm dev`) mounts under /v1, on PORT (default 3000, matching
// APP_URL/BETTER_AUTH_URL in .env.example). Run one or the other, not both.
import { serve } from '@hono/node-server'
import { startTracing } from '@splitune/analytics/tracing'
import { createDb } from '@splitune/db'
import { createStorage, storageConfigFromEnv } from '@splitune/storage'
import { createApi } from './app.ts'
import { configFromEnv } from './config.ts'

const config = configFromEnv()
await startTracing('splitune-api')
const { DATABASE_URL, PORT = '3000' } = process.env
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set')

const db = createDb({ url: DATABASE_URL, applicationName: 'splitune-api' })
const app = createApi({ db, storage: createStorage(storageConfigFromEnv()), config })

const server = serve({ fetch: app.fetch, port: Number(PORT) }, ({ port }) => {
  process.stdout.write(
    `${JSON.stringify({ level: 'info', service: 'api', msg: 'listening', port })}\n`,
  )
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      db.$client.end().then(
        () => process.exit(0),
        () => process.exit(1),
      )
    })
  })
}
