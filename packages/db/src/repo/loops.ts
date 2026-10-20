import { and, asc, eq } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { loopClips } from '../schema/index.ts'

export type LoopClip = typeof loopClips.$inferSelect
export type NewLoopClip = Omit<
  typeof loopClips.$inferInsert,
  'id' | 'userId' | 'songId' | 'createdAt'
>
export type LoopClipPatch = Partial<NewLoopClip>

export function loopsRepo(db: Database) {
  return {
    create: (userId: string, songId: string, input: NewLoopClip) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .insert(loopClips)
          .values({ ...input, userId, songId })
          .returning()
        return row as LoopClip
      }),

    list: (userId: string, songId: string) =>
      withUser(db, userId, (tx) =>
        tx
          .select()
          .from(loopClips)
          .where(and(eq(loopClips.userId, userId), eq(loopClips.songId, songId)))
          .orderBy(asc(loopClips.startS), asc(loopClips.createdAt)),
      ),

    update: (userId: string, loopId: string, patch: LoopClipPatch) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .update(loopClips)
          .set(patch)
          .where(and(eq(loopClips.userId, userId), eq(loopClips.id, loopId)))
          .returning()
        return row
      }),

    delete: (userId: string, loopId: string) =>
      withUser(db, userId, async (tx) => {
        const rows = await tx
          .delete(loopClips)
          .where(and(eq(loopClips.userId, userId), eq(loopClips.id, loopId)))
          .returning({ id: loopClips.id })
        return rows.length > 0
      }),
  }
}
