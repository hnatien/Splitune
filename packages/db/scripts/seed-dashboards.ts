// pnpm --filter @splitune/db seed:dashboards [YYYY-MM-DD] — local only: a synthetic week of product
// data (synthetic-week.ts) starting on that day (default: 7 days ago), so the Grafana dashboards
// (infra/grafana) have something to show. Refuses to run with NODE_ENV=production.
import { createDb } from '../src/index.ts'
import { requireEnv } from './env.ts'
import { seedSyntheticWeek } from './synthetic-week.ts'

const { NODE_ENV } = process.env
if (NODE_ENV === 'production') {
  console.error('seed:dashboards is for local databases only.')
  process.exit(1)
}
const day = process.argv[2] ?? new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
const start = new Date(`${day}T00:00:00Z`)
if (Number.isNaN(start.getTime())) {
  console.error('usage: seed:dashboards [YYYY-MM-DD]')
  process.exit(2)
}
const db = createDb({ url: requireEnv('DATABASE_URL'), max: 1, applicationName: 'splitune-seed' })
try {
  const { userIds } = await seedSyntheticWeek(db, { start })
  console.log(`Seeded a synthetic week from ${day} for ${userIds.length} users.`)
} finally {
  await db.$client.end()
}
