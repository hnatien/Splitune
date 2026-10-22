import { StageName } from '@splitune/contracts'
import { and, asc, desc, eq, ilike, inArray, isNotNull, type SQL, sql } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { enqueue } from '../jobs/queue.ts'
import {
  analyses,
  artefacts,
  jobs,
  loopClips,
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

// Library query (27 §3.5). `analysing` covers songs still importing (URL download) or analysing.
// last_practised is the library order above: opening the practice screen bumps last_opened_at,
// which stands in for "last practised" until practice sessions are synced (step 12).
export type LibrarySort = 'last_practised' | 'added' | 'title'
export type LibraryStatus = 'ready' | 'partial' | 'analysing' | 'failed'

// Keyset position of the last row of a page, per sort.
export type LibraryCursor =
  | { sort: 'last_practised'; lastOpenedAt: Date | null; createdAt: Date; id: string }
  | { sort: 'added'; createdAt: Date; id: string }
  | { sort: 'title'; title: string; id: string }

export interface LibraryQuery {
  q?: string
  instrument?: Song['instrument']
  status?: LibraryStatus
  sort?: LibrarySort
  limit?: number
  after?: LibraryCursor
}

type AnalysisRow = typeof analyses.$inferSelect

export interface LibraryEntry {
  song: Song
  // The song's latest analysis; stages finished (done, failed or skipped) of those planned, with
  // the decode and beats it reuses from its base analysis counted as finished.
  latestAnalysis: {
    id: string
    type: AnalysisRow['analysisType']
    status: AnalysisRow['status']
    recommendedView: AnalysisRow['recommendedView']
    stagesDone: number
    stagesTotal: number
  } | null
  // Stems of the latest finished (done or partial) analysis: playable, all expired, or none.
  stems: 'available' | 'expired' | 'none'
  // The clip with the best clean tempo (bars are 0-based bar_index).
  bestClean: { tempoPct: number; startBar: number; endBar: number } | null
}

const STAGE_KINDS = StageName.options as readonly string[]
const FINISHED_JOB = sql`status in ('done', 'failed', 'cancelled')`
const REUSED_STAGES = ['decode', 'beats'] as const
const LIBRARY_STATUS: Record<LibraryStatus, Song['status'][]> = {
  ready: ['ready'],
  partial: ['partial'],
  analysing: ['importing', 'analysing'],
  failed: ['failed'],
}

// LIKE pattern for a literal substring.
const contains = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

function libraryOrder(sort: LibrarySort, after: LibraryCursor | undefined) {
  const titleKey = sql`lower(${songs.title})`
  if (after !== undefined && after.sort !== sort) throw new Error('cursor of another sort')
  switch (sort) {
    case 'added':
      return {
        order: [desc(songs.createdAt), desc(songs.id)],
        where:
          after?.sort === 'added'
            ? sql`(${songs.createdAt}, ${songs.id}) < (${after.createdAt}::timestamptz, ${after.id}::uuid)`
            : undefined,
      }
    case 'title':
      return {
        order: [asc(titleKey), asc(songs.id)],
        where:
          after?.sort === 'title'
            ? sql`(${titleKey}, ${songs.id}) > (lower(${after.title}), ${after.id}::uuid)`
            : undefined,
      }
    case 'last_practised':
      return {
        order: [desc(openedAt), desc(songs.createdAt), desc(songs.id)],
        where:
          after?.sort === 'last_practised'
            ? sql`(${openedAt}, ${songs.createdAt}, ${songs.id}) < (coalesce(${after.lastOpenedAt}::timestamptz, 'epoch'::timestamptz), ${after.createdAt}::timestamptz, ${after.id}::uuid)`
            : undefined,
      }
  }
}

// Ids whose storage prefixes hold the song's objects (raw uploads, analysis outputs).
export interface SongObjects {
  uploadIds: string[]
  analysisIds: string[]
}

// Payload of the node worker's `delete_prefix` job (RLS policy jobs_owner_cleanup checks it).
export const DELETE_PREFIX_JOB = 'delete_prefix'
// Deleting the rows takes the song's jobs with them, so a stage that is running at that moment
// loses its lock, but it may still upload outputs before it notices. A second cleanup pass after
// the longest stage timeout (separate: 25 min) removes those.
export const CLEANUP_REPEAT_AFTER_S = 30 * 60

// Never-opened songs sort after opened ones; the epoch stands in for "never" so the order and the
// cursor comparison use one expression.
const openedAt = sql`coalesce(${songs.lastOpenedAt}, 'epoch'::timestamptz)`

// The `after` cursor that continues a library page after this song.
export function libraryCursor(sort: LibrarySort, song: Song): LibraryCursor {
  switch (sort) {
    case 'added':
      return { sort, createdAt: song.createdAt, id: song.id }
    case 'title':
      return { sort, title: song.title, id: song.id }
    case 'last_practised':
      return { sort, lastOpenedAt: song.lastOpenedAt, createdAt: song.createdAt, id: song.id }
  }
}

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

    // One library page with what each card shows (LibraryEntry); keyset pagination per sort:
    // pass the cursor of the last entry as `after` (libraryCursor). A cursor of another sort
    // throws.
    library: (userId: string, query: LibraryQuery = {}) =>
      withUser(db, userId, async (tx): Promise<LibraryEntry[]> => {
        const sort = query.sort ?? 'last_practised'
        const { order, where } = libraryOrder(sort, query.after)
        const filters: (SQL | undefined)[] = [
          eq(songs.userId, userId),
          query.q === undefined ? undefined : ilike(songs.title, contains(query.q)),
          query.instrument === undefined ? undefined : eq(songs.instrument, query.instrument),
          query.status === undefined
            ? undefined
            : inArray(songs.status, LIBRARY_STATUS[query.status]),
          where,
        ]
        const page = await tx
          .select()
          .from(songs)
          .where(and(...filters))
          .orderBy(...order)
          .limit(query.limit ?? 50)
        if (page.length === 0) return []
        const songIds = page.map((song) => song.id)

        const latest = await tx
          .selectDistinctOn([analyses.songId])
          .from(analyses)
          .where(and(eq(analyses.userId, userId), inArray(analyses.songId, songIds)))
          .orderBy(analyses.songId, desc(analyses.createdAt))
        const finished = await tx
          .selectDistinctOn([analyses.songId], { songId: analyses.songId, id: analyses.id })
          .from(analyses)
          .where(
            and(
              eq(analyses.userId, userId),
              inArray(analyses.songId, songIds),
              inArray(analyses.status, ['done', 'partial']),
            ),
          )
          .orderBy(analyses.songId, desc(analyses.createdAt))
        const latestIds = latest.map((a) => a.id)
        const baseIds = latest.flatMap((a) => (a.baseAnalysisId ? [a.baseAnalysisId] : []))
        const jobCounts =
          latestIds.length === 0
            ? []
            : await tx
                .select({
                  analysisId: jobs.analysisId,
                  kinds: sql<string[]>`array_agg(${jobs.kind})`,
                  done: sql<number>`(count(*) filter (where ${FINISHED_JOB}))::int`,
                })
                .from(jobs)
                .where(
                  and(inArray(jobs.analysisId, latestIds), inArray(jobs.kind, [...STAGE_KINDS])),
                )
                .groupBy(jobs.analysisId)
        const reused =
          baseIds.length === 0
            ? []
            : await tx
                .select({ analysisId: stageRuns.analysisId, stage: stageRuns.stage })
                .from(stageRuns)
                .where(
                  and(
                    inArray(stageRuns.analysisId, baseIds),
                    inArray(stageRuns.stage, [...REUSED_STAGES]),
                  ),
                )
        const finishedIds = finished.map((a) => a.id)
        const stems =
          finishedIds.length === 0
            ? []
            : await tx
                .select({
                  analysisId: artefacts.analysisId,
                  live: sql<boolean>`bool_or(${artefacts.purgedAt} is null)`,
                })
                .from(artefacts)
                .where(
                  and(
                    eq(artefacts.userId, userId),
                    inArray(artefacts.analysisId, finishedIds),
                    eq(artefacts.kind, 'stems'),
                  ),
                )
                .groupBy(artefacts.analysisId)
        const best = await tx
          .selectDistinctOn([loopClips.songId], {
            songId: loopClips.songId,
            tempoPct: loopClips.bestCleanTempoPct,
            startBar: loopClips.startBar,
            endBar: loopClips.endBar,
          })
          .from(loopClips)
          .where(
            and(
              eq(loopClips.userId, userId),
              inArray(loopClips.songId, songIds),
              isNotNull(loopClips.bestCleanTempoPct),
            ),
          )
          .orderBy(loopClips.songId, desc(loopClips.bestCleanTempoPct), desc(loopClips.createdAt))

        return page.map((song): LibraryEntry => {
          const analysis = latest.find((a) => a.songId === song.id)
          let latestAnalysis: LibraryEntry['latestAnalysis'] = null
          if (analysis) {
            const counts = jobCounts.find((c) => c.analysisId === analysis.id)
            const kinds = new Set(counts?.kinds ?? [])
            const extra = reused.filter(
              (r) => r.analysisId === analysis.baseAnalysisId && !kinds.has(r.stage),
            ).length
            latestAnalysis = {
              id: analysis.id,
              type: analysis.analysisType,
              status: analysis.status,
              recommendedView: analysis.recommendedView,
              stagesDone: (counts?.done ?? 0) + extra,
              stagesTotal: kinds.size + extra,
            }
          }
          const finishedId = finished.find((a) => a.songId === song.id)?.id
          const stemRow = stems.find((r) => r.analysisId === finishedId)
          const clip = best.find((b) => b.songId === song.id)
          return {
            song,
            latestAnalysis,
            stems: stemRow === undefined ? 'none' : stemRow.live ? 'available' : 'expired',
            bestClean:
              clip?.tempoPct == null
                ? null
                : { tempoPct: clip.tempoPct, startBar: clip.startBar, endBar: clip.endBar },
          }
        })
      }),

    // The song, its latest analysis (stages and artefacts: analyses.detail) and YouTube
    // reference; opening a song also bumps last_opened_at (library order). Undefined if the song
    // is not the user's.
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

    // Rows cascade to uploads, analyses (with their queued and running jobs), artefacts,
    // corrections, loops and practice logs. Objects are deleted by the node worker: in the same transaction this enqueues a `delete_prefix` job
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
          const payload = { user_id: userId, prefixes }
          await enqueue(tx, DELETE_PREFIX_JOB, 'node', payload)
          await enqueue(tx, DELETE_PREFIX_JOB, 'node', payload, {
            runAfter: new Date(Date.now() + CLEANUP_REPEAT_AFTER_S * 1000),
          })
        }
        return true
      }),
  }
}
