import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema/index.ts'

export type Database = NodePgDatabase<typeof schema> & { $client: pg.Pool }
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
// Anything queries can run on: the pool-backed database or an open transaction.
export type Executor = Database | Transaction

export interface DbOptions {
  url: string
  max?: number
  applicationName?: string
}

export function createDb({ url, max = 10, applicationName = 'splitune' }: DbOptions): Database {
  const pool = new pg.Pool({ connectionString: url, max, application_name: applicationName })
  return drizzle({ client: pool, schema })
}

// Better Auth ids are URL-safe alphanumerics; anything else (including '') is a caller bug.
const USER_ID = /^[A-Za-z0-9_-]{1,128}$/

export function assertUserId(userId: string): void {
  if (!USER_ID.test(userId)) throw new TypeError('invalid user id')
}

// Runs `fn` in a transaction as role `app` with `app.user_id` set, so RLS limits every user table
// to `userId` (17-security.md §2). Both settings are transaction-local and vanish on commit or
// rollback, so pooled connections never leak one user's scope into another request.
export async function withUser<T>(
  db: Database,
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  assertUserId(userId)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`)
    await tx.execute(sql`set local role app`)
    return fn(tx)
  })
}
