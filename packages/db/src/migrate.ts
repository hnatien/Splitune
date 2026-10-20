import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from './client.ts'

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url))

// Applies all pending migrations in one transaction (all or nothing), recording them in
// drizzle.__drizzle_migrations. Must run as the database owner: 0002 creates roles.
export async function runMigrations(url: string): Promise<void> {
  const db = createDb({ url, max: 1, applicationName: 'splitune-migrate' })
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  } finally {
    await db.$client.end()
  }
}
