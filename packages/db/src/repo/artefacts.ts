import { and, asc, eq } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { artefacts } from '../schema/index.ts'

export type Artefact = typeof artefacts.$inferSelect

// Read-only for the API: artefacts are written by the workers.
export function artefactsRepo(db: Database) {
  return {
    get: (userId: string, artefactId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select()
          .from(artefacts)
          .where(and(eq(artefacts.userId, userId), eq(artefacts.id, artefactId)))
        return row
      }),

    listForAnalysis: (userId: string, analysisId: string) =>
      withUser(db, userId, (tx) =>
        tx
          .select()
          .from(artefacts)
          .where(and(eq(artefacts.userId, userId), eq(artefacts.analysisId, analysisId)))
          .orderBy(asc(artefacts.kind), asc(artefacts.version)),
      ),
  }
}
