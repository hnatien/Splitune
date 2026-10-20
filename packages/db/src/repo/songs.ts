import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { enqueue } from '../jobs/queue.ts'
import {
  analyses,
  artefacts,
  songs,
  stageRuns,
  syncPoints,
  uploads,
  youtubeRefs,
} from '../schema/index.ts'

export type Song = typeof songs.$inferSelect
export type NewSong = Omit<typeof songs.$inferInsert, 'id' | 'userId' | 'createdAt'>
export type SongPatch = Partial<
  Pick<Song, 'title' | 'artist' | 'instrument' | 'playerState' | 'lastOpenedAt'>
>

// Position in the library order, used as the pagination cursor.
export interface SongCursor {
  lastOpenedAt: Date | null
  createdAt: Date
  id: string
}

// Ids whose storage prefixes hold the song's objects (raw uploads, analysis outputs).
export interface SongObjects {
  uploadIds: string[]
  analysisIds: string[]
}

// Payload of the node worker's `delete_prefix` job (RLS policy jobs_owner_cleanup checks it).
export const DELETE_PREFIX_JOB = 'delete_prefix'

// Never-opened songs sort after opened ones; the epoch stands in for "never" so the order and the
// cursor comparison use one expression.
const openedAt = sql`coalesce(${songs.lastOpenedAt}, 'epoch'::timestamptz)`

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

    // Library order: most recently opened first, never-opened songs by creation date. Keyset
    // pagination: pass the last row of a page as `after` to get the next one.
    list: (userId: string, { limit = 50, after }: { limit?: number; after?: SongCursor } = {}) =>
      withUser(db, userId, (tx) =>
        tx
          .select()
          .from(songs)
          .where(
            and(
              eq(songs.userId, userId),
              after === undefined
                ? undefined
                : sql`(${openedAt}, ${songs.createdAt}, ${songs.id}) < (coalesce(${after.lastOpenedAt}::timestamptz, 'epoch'::timestamptz), ${after.createdAt}::timestamptz, ${after.id}::uuid)`,
            ),
          )
          .orderBy(desc(openedAt), desc(songs.createdAt), desc(songs.id))
          .limit(limit),
      ),

    // Everything the song screen needs in one transaction; opening a song also bumps
    // last_opened_at (library order). Undefined if the song is not the user's.
    open: (userId: string, songId: string) =>
      withUser(db, userId, async (tx) => {
        const [song] = await tx
          .update(songs)
          .set({ lastOpenedAt: new Date() })
          .where(and(eq(songs.userId, userId), eq(songs.id, songId)))
          .returning()
        if (!song) return undefined
        const [latestAnalysis] = await tx
          .select()
          .from(analyses)
          .where(and(eq(analyses.userId, userId), eq(analyses.songId, songId)))
          .orderBy(desc(analyses.createdAt))
          .limit(1)
        const stages = latestAnalysis
          ? await tx.select().from(stageRuns).where(eq(stageRuns.analysisId, latestAnalysis.id))
          : []
        const artefactRows = latestAnalysis
          ? await tx
              .select()
              .from(artefacts)
              .where(and(eq(artefacts.userId, userId), eq(artefacts.analysisId, latestAnalysis.id)))
              .orderBy(asc(artefacts.kind), asc(artefacts.version))
          : []
        const [youtube] = await tx
          .select()
          .from(youtubeRefs)
          .where(and(eq(youtubeRefs.userId, userId), eq(youtubeRefs.songId, songId)))
        const points = youtube
          ? await tx
              .select()
              .from(syncPoints)
              .where(eq(syncPoints.songId, songId))
              .orderBy(asc(syncPoints.idx))
          : []
        return {
          song,
          latestAnalysis,
          stages,
          artefacts: artefactRows,
          youtube: youtube ? { videoId: youtube.videoId, syncPoints: points } : undefined,
        }
      }),

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

    // Rows cascade to uploads, analyses, artefacts, corrections, loops and practice logs. Objects
    // are deleted by the node worker: in the same transaction this enqueues a `delete_prefix` job
    // with the prefixes `objectPrefixes` returns for the song's uploads and analyses
    // (03 "Retention and deletion"). Returns false if the song is not the user's.
    delete: (userId: string, songId: string, objectPrefixes: (objects: SongObjects) => string[]) =>
      withUser(db, userId, async (tx) => {
        const owned = and(eq(songs.userId, userId), eq(songs.id, songId))
        const [song] = await tx.select({ id: songs.id }).from(songs).where(owned).for('update')
        if (!song) return false
        const uploadRows = await tx
          .select({ id: uploads.id })
          .from(uploads)
          .where(and(eq(uploads.userId, userId), eq(uploads.songId, songId)))
        const analysisRows = await tx
          .select({ id: analyses.id })
          .from(analyses)
          .where(and(eq(analyses.userId, userId), eq(analyses.songId, songId)))
        await tx.delete(songs).where(owned)
        const prefixes = objectPrefixes({
          uploadIds: uploadRows.map((r) => r.id),
          analysisIds: analysisRows.map((r) => r.id),
        })
        if (prefixes.length > 0) {
          await enqueue(tx, DELETE_PREFIX_JOB, 'node', { user_id: userId, prefixes })
        }
        return true
      }),
  }
}
