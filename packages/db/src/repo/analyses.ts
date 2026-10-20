import { and, desc, eq } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { analyses } from '../schema/index.ts'

export type Analysis = typeof analyses.$inferSelect
export type NewAnalysis = Omit<
  typeof analyses.$inferInsert,
  'id' | 'userId' | 'createdAt' | 'finishedAt' | 'progress'
>

export function analysesRepo(db: Database) {
  return {
    // Idempotent on (user_id, idempotency_key): a repeated request returns the existing run.
    createOrGet: (userId: string, input: NewAnalysis) =>
      withUser(db, userId, async (tx) => {
        const [inserted] = await tx
          .insert(analyses)
          .values({ ...input, userId })
          .onConflictDoNothing({ target: [analyses.userId, analyses.idempotencyKey] })
          .returning()
        if (inserted) return { analysis: inserted, created: true }
        const [existing] = await tx
          .select()
          .from(analyses)
          .where(
            and(eq(analyses.userId, userId), eq(analyses.idempotencyKey, input.idempotencyKey)),
          )
        return { analysis: existing as Analysis, created: false }
      }),

    get: (userId: string, analysisId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select()
          .from(analyses)
          .where(and(eq(analyses.userId, userId), eq(analyses.id, analysisId)))
        return row
      }),

    listForSong: (userId: string, songId: string) =>
      withUser(db, userId, (tx) =>
        tx
          .select()
          .from(analyses)
          .where(and(eq(analyses.userId, userId), eq(analyses.songId, songId)))
          .orderBy(desc(analyses.createdAt)),
      ),
  }
}
