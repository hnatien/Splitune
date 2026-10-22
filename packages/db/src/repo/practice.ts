import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { loopClips, practiceAttempts, practiceSessions, songs } from '../schema/index.ts'

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
        // A clip deleted while the attempt waited offline (or not the user's) leaves the attempt
        // without a clip instead of failing the batch.
        const clipIds = [...new Set(attempts.flatMap((a) => (a.loopClipId ? [a.loopClipId] : [])))]
        const clips =
          clipIds.length === 0
            ? []
            : await tx
                .select({ id: loopClips.id })
                .from(loopClips)
                .where(and(eq(loopClips.userId, userId), inArray(loopClips.id, clipIds)))
        const ownedClips = new Set(clips.map((c) => c.id))
        const values = attempts.flatMap(({ clientSessionId, ...attempt }) => {
          const sessionId = sessionIdByClientId.get(clientSessionId)
          if (!sessionId) return []
          const loopClipId =
            attempt.loopClipId && ownedClips.has(attempt.loopClipId) ? attempt.loopClipId : null
          return [{ ...attempt, loopClipId, userId, sessionId }]
        })
        if (values.length === 0) return []
        const inserted = await tx
          .insert(practiceAttempts)
          .values(values)
          .onConflictDoNothing({ target: practiceAttempts.clientAttemptId })
          .returning({
            loopClipId: practiceAttempts.loopClipId,
            tempoPct: practiceAttempts.tempoPct,
            outcome: practiceAttempts.outcome,
          })
        // The progress metric (12 §5): the fastest clean pass per clip. Replays insert nothing,
        // so they never move it.
        const best = new Map<string, number>()
        for (const a of inserted) {
          if (a.outcome !== 'clean' || !a.loopClipId) continue
          best.set(a.loopClipId, Math.max(best.get(a.loopClipId) ?? 0, a.tempoPct))
        }
        for (const [id, tempo] of best) {
          await tx
            .update(loopClips)
            .set({
              bestCleanTempoPct: sql`greatest(coalesce(${loopClips.bestCleanTempoPct}, 0), ${tempo})`,
            })
            .where(and(eq(loopClips.userId, userId), eq(loopClips.id, id)))
        }
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

    // GET /v1/progress: every clip (optionally of one song) with its attempts in time order.
    progress: (userId: string, songId?: string) =>
      withUser(db, userId, async (tx) => {
        const clips = await tx
          .select({
            id: loopClips.id,
            songId: loopClips.songId,
            bestCleanTempoPct: loopClips.bestCleanTempoPct,
          })
          .from(loopClips)
          .where(
            and(
              eq(loopClips.userId, userId),
              songId === undefined ? undefined : eq(loopClips.songId, songId),
            ),
          )
          .orderBy(asc(loopClips.createdAt))
        const attempts =
          clips.length === 0
            ? []
            : await tx
                .select({
                  loopClipId: practiceAttempts.loopClipId,
                  at: practiceAttempts.at,
                  tempoPct: practiceAttempts.tempoPct,
                  outcome: practiceAttempts.outcome,
                })
                .from(practiceAttempts)
                .where(
                  and(
                    eq(practiceAttempts.userId, userId),
                    inArray(
                      practiceAttempts.loopClipId,
                      clips.map((c) => c.id),
                    ),
                  ),
                )
                .orderBy(asc(practiceAttempts.at))
        return clips.map((clip) => ({
          ...clip,
          attempts: attempts.filter((a) => a.loopClipId === clip.id),
        }))
      }),
  }
}
