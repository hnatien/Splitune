import { and, eq, inArray, sql } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { practiceAttempts, practiceSessions, songs } from '../schema/index.ts'

export type PracticeSession = typeof practiceSessions.$inferSelect
export type PracticeAttempt = typeof practiceAttempts.$inferSelect
export type SessionInput = Omit<typeof practiceSessions.$inferInsert, 'id' | 'userId'>
export type AttemptInput = Omit<
  typeof practiceAttempts.$inferInsert,
  'id' | 'userId' | 'sessionId'
> & {
  clientSessionId: string
}

// Offline sync (POST /v1/practice/sync): client ids make every write idempotent, and ids that are
// already stored count as accepted so the client can clear its outbox.
export function practiceRepo(db: Database) {
  return {
    upsertSessions: (userId: string, sessions: SessionInput[]) =>
      withUser(db, userId, async (tx) => {
        if (sessions.length === 0) return []
        const songIds = [...new Set(sessions.map((s) => s.songId))]
        const owned = await tx
          .select({ id: songs.id })
          .from(songs)
          .where(and(eq(songs.userId, userId), inArray(songs.id, songIds)))
        const ownedIds = new Set(owned.map((s) => s.id))
        const valid = sessions.filter((s) => ownedIds.has(s.songId))
        if (valid.length === 0) return []
        const rows = await tx
          .insert(practiceSessions)
          .values(valid.map((s) => ({ ...s, userId })))
          .onConflictDoUpdate({
            target: practiceSessions.clientSessionId,
            set: {
              endedAt: sql`coalesce(excluded.ended_at, ${practiceSessions.endedAt})`,
            },
          })
          .returning({ clientSessionId: practiceSessions.clientSessionId })
        return rows.map((r) => r.clientSessionId)
      }),

    recordAttempts: (userId: string, attempts: AttemptInput[]) =>
      withUser(db, userId, async (tx) => {
        if (attempts.length === 0) return []
        const clientSessionIds = [...new Set(attempts.map((a) => a.clientSessionId))]
        const sessions = await tx
          .select({ id: practiceSessions.id, clientSessionId: practiceSessions.clientSessionId })
          .from(practiceSessions)
          .where(
            and(
              eq(practiceSessions.userId, userId),
              inArray(practiceSessions.clientSessionId, clientSessionIds),
            ),
          )
        const sessionIdByClientId = new Map(sessions.map((s) => [s.clientSessionId, s.id]))
        const values = attempts.flatMap(({ clientSessionId, ...attempt }) => {
          const sessionId = sessionIdByClientId.get(clientSessionId)
          return sessionId ? [{ ...attempt, userId, sessionId }] : []
        })
        if (values.length === 0) return []
        await tx.insert(practiceAttempts).values(values).onConflictDoNothing({
          target: practiceAttempts.clientAttemptId,
        })
        const stored = await tx
          .select({ clientAttemptId: practiceAttempts.clientAttemptId })
          .from(practiceAttempts)
          .where(
            and(
              eq(practiceAttempts.userId, userId),
              inArray(
                practiceAttempts.clientAttemptId,
                values.map((v) => v.clientAttemptId),
              ),
            ),
          )
        return stored.map((s) => s.clientAttemptId)
      }),
  }
}
