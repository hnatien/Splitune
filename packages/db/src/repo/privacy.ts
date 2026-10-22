import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { enqueue } from '../jobs/queue.ts'
import { dataExports, users } from '../schema/index.ts'

export type DataExportRow = typeof dataExports.$inferSelect

// Node worker jobs for privacy self-service (15 §4); payload { user_id, … }, no analysis. RLS
// policy jobs_owner_account lets `app` enqueue them only for its own user.
export const EXPORT_JOB = 'export_user_data'
export const DELETE_ACCOUNT_JOB = 'delete_account'

export function privacyRepo(db: Database) {
  return {
    // The user's latest "Download my data" request, if any.
    latestExport: (userId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select()
          .from(dataExports)
          .where(eq(dataExports.userId, userId))
          .orderBy(desc(dataExports.requestedAt))
          .limit(1)
        return row
      }),

    // Records a request and enqueues its job in one transaction; while one is still pending, a
    // repeated request returns it instead. `objectKey` names the bundle from the request id.
    requestExport: (userId: string, objectKey: (exportId: string) => string) =>
      withUser(db, userId, async (tx) => {
        // Serialises concurrent requests of one user.
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update')
        const [pending] = await tx
          .select()
          .from(dataExports)
          .where(and(eq(dataExports.userId, userId), eq(dataExports.status, 'pending')))
          .limit(1)
        if (pending) return pending
        const id = randomUUID()
        const [row] = await tx
          .insert(dataExports)
          .values({ id, userId, objectKey: objectKey(id) })
          .returning()
        await enqueue(tx, EXPORT_JOB, 'node', { user_id: userId, export_id: id })
        return row as DataExportRow
      }),

    // Marks the account deleted and queues its purge (objects, then rows) in one transaction.
    // Returns when it was marked; a repeated call queues nothing new. undefined: no such user.
    requestDeletion: (userId: string) =>
      withUser(db, userId, async (tx) => {
        const [user] = await tx
          .select({ deletedAt: users.deletedAt })
          .from(users)
          .where(eq(users.id, userId))
          .for('update')
        if (!user) return undefined
        if (user.deletedAt) return user.deletedAt
        const now = new Date()
        await tx.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, userId))
        await enqueue(tx, DELETE_ACCOUNT_JOB, 'node', { user_id: userId })
        return now
      }),
  }
}
