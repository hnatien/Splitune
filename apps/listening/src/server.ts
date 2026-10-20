// `pnpm --filter @splitune/listening dev` with LISTENING_SESSION_DIR pointing at a session written by
// services/ml/eval/p1.py export. Binds to localhost only: there is no login (solo rater, 08 §1).
import { serve } from '@hono/node-server'
import pg from 'pg'
import { createApp } from './app.ts'
import { loadManifest } from './session.ts'
import { Store } from './store.ts'

const { DATABASE_URL, LISTENING_SESSION_DIR, LISTENING_PORT = '4100' } = process.env
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set')
if (!LISTENING_SESSION_DIR) throw new Error('LISTENING_SESSION_DIR is not set')

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 4,
  application_name: 'splitune-listening',
})
const store = new Store(pool)
await store.bootstrap()
const manifest = loadManifest(LISTENING_SESSION_DIR)
const app = createApp(manifest, LISTENING_SESSION_DIR, store)

const server = serve(
  { fetch: app.fetch, port: Number(LISTENING_PORT), hostname: '127.0.0.1' },
  ({ port }) => {
    process.stdout.write(
      `${JSON.stringify({ level: 'info', service: 'listening', msg: 'listening', port, session: manifest.id })}\n`,
    )
  },
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      pool.end().then(
        () => process.exit(0),
        () => process.exit(1),
      )
    })
  })
}
