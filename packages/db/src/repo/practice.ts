import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm'
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

    // GET /v1/progress (12 §5, s39): every clip (optionally of one song) with its attempts in time
    // order, and the sessions with their pass counts over every loop, clip or not. `days` keeps
    // attempts and sessions to the last n days; a clip's last attempt is over all time, so Worth a
    // revisit can tell how long ago a clip was played.
    progress: (userId: string, songId?: string, days?: number) =>
      withUser(db, userId, async (tx) => {
        const since = days === undefined ? undefined : new Date(Date.now() - days * 86_400_000)
        const clips = await tx
          .select({
            id: loopClips.id,
            songId: loopClips.songId,
            name: loopClips.name,
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
        const clipIds = clips.map((c) => c.id)
        const attempts =
          clipIds.length === 0
            ? []
            : await tx
                .select({
                  loopClipId: practiceAttempts.loopClipId,
                  at: practiceAttempts.at,
                  tempoPct: practiceAttempts.tempoPct,
                  outcome: practiceAttempts.outcome,
                  clientSessionId: practiceSessions.clientSessionId,
                })
                .from(practiceAttempts)
                .innerJoin(practiceSessions, eq(practiceSessions.id, practiceAttempts.sessionId))
                .where(
                  and(
                    eq(practiceAttempts.userId, userId),
                    inArray(practiceAttempts.loopClipId, clipIds),
                    since === undefined ? undefined : gte(practiceAttempts.at, since),
                  ),
                )
                .orderBy(asc(practiceAttempts.at))
        const latest =
          clipIds.length === 0
            ? []
            : await tx
                .select({
                  loopClipId: practiceAttempts.loopClipId,
                  at: sql<Date>`max(${practiceAttempts.at})`.mapWith(practiceAttempts.at),
                })
                .from(practiceAttempts)
                .where(
                  and(
                    eq(practiceAttempts.userId, userId),
                    inArray(practiceAttempts.loopClipId, clipIds),
                  ),
                )
                .groupBy(practiceAttempts.loopClipId)
        const lastAttemptAt = new Map(latest.map((l) => [l.loopClipId, l.at]))
        const sessions = await tx
          .select({
            clientSessionId: practiceSessions.clientSessionId,
            songId: practiceSessions.songId,
            startedAt: practiceSessions.startedAt,
            endedAt: practiceSessions.endedAt,
            passes: sql<number>`count(${practiceAttempts.id})::int`,
            cleanPasses: sql<number>`(count(${practiceAttempts.id}) filter (where ${practiceAttempts.outcome} = 'clean'))::int`,
          })
          .from(practiceSessions)
          .leftJoin(practiceAttempts, eq(practiceAttempts.sessionId, practiceSessions.id))
          .where(
            and(
              eq(practiceSessions.userId, userId),
              songId === undefined ? undefined : eq(practiceSessions.songId, songId),
              since === undefined ? undefined : gte(practiceSessions.startedAt, since),
            ),
          )
          .groupBy(practiceSessions.id)
          .orderBy(asc(practiceSessions.startedAt))
        return {
          clips: clips.map((clip) => ({
            ...clip,
            lastAttemptAt: lastAttemptAt.get(clip.id) ?? null,
            attempts: attempts.filter((a) => a.loopClipId === clip.id),
          })),
          sessions,
        }
      }),
  }
}
