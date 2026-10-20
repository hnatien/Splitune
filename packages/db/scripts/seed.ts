// pnpm seed — idempotent local seed: the system user (owner of example songs, 03 "Notes") and one
// test user. Better Auth credentials for the test user arrive with step 04.
import { createDb, users } from '../src/index.ts'
import { requireEnv } from './env.ts'

const SEED_USERS = [
  { id: 'system', email: 'system@splitune.localhost', displayName: 'Splitune' },
  {
    id: 'test-user',
    email: 'test@splitune.localhost',
    displayName: 'Test User',
    primaryInstrument: 'guitar',
    level: 'few_songs',
  },
] satisfies (typeof users.$inferInsert)[]

const db = createDb({ url: requireEnv('DATABASE_URL'), max: 1, applicationName: 'splitune-seed' })
try {
  const inserted = await db
    .insert(users)
    .values(SEED_USERS)
    .onConflictDoNothing({ target: users.id })
    .returning({ id: users.id })
  console.log(
    `Seeded ${inserted.length} new user(s); ${SEED_USERS.length - inserted.length} existed.`,
  )
} finally {
  await db.$client.end()
}
