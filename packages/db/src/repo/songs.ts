import { and, desc, eq, sql } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { songs } from '../schema/index.ts'

export type Song = typeof songs.$inferSelect
export type NewSong = Omit<typeof songs.$inferInsert, 'id' | 'userId' | 'createdAt'>
export type SongPatch = Partial<Pick<Song, 'title' | 'artist' | 'playerState' | 'lastOpenedAt'>>

export function songsRepo(db: Database) {
  return {
    create: (userId: string, input: NewSong) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .insert(songs)
          .values({ ...input, userId })
          .returning()
        return row as Song
      }),

    get: (userId: string, songId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select()
          .from(songs)
          .where(and(eq(songs.userId, userId), eq(songs.id, songId)))
        return row
      }),

    // Library order: most recently opened first, never-opened songs by creation date.
    list: (userId: string, { limit = 50 }: { limit?: number } = {}) =>
      withUser(db, userId, (tx) =>
        tx
          .select()
          .from(songs)
          .where(eq(songs.userId, userId))
          .orderBy(sql`${songs.lastOpenedAt} desc nulls last`, desc(songs.createdAt))
          .limit(limit),
      ),

    findByAudioHash: (userId: string, audioHash: string, instrument: Song['instrument']) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select()
          .from(songs)
          .where(
            and(
              eq(songs.userId, userId),
              eq(songs.audioHash, audioHash),
              eq(songs.instrument, instrument),
            ),
          )
        return row
      }),

    update: (userId: string, songId: string, patch: SongPatch) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .update(songs)
          .set(patch)
          .where(and(eq(songs.userId, userId), eq(songs.id, songId)))
          .returning()
        return row
      }),

    // Rows cascade to uploads, analyses, artefacts, corrections, loops and practice logs; objects
    // under the song's storage prefixes are deleted by a separate job (03 "Retention and deletion").
    delete: (userId: string, songId: string) =>
      withUser(db, userId, async (tx) => {
        const rows = await tx
          .delete(songs)
          .where(and(eq(songs.userId, userId), eq(songs.id, songId)))
          .returning({ id: songs.id })
        return rows.length > 0
      }),
  }
}
