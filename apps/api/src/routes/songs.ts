import type {
  Analysis as AnalysisSchema,
  ArtefactIndexEntry,
  SongDetail as SongDetailSchema,
  Song as SongSchema,
} from '@splitune/contracts'
import type { Analysis, Artefact, Song, SongCursor, SongPatch, stageRuns } from '@splitune/db'
import { analysisPrefix, uploadPrefix } from '@splitune/storage'
import { z } from 'zod'
import { apiError } from '../errors.ts'
import { authed } from '../procedures.ts'

type SongOut = z.infer<typeof SongSchema>
type StageRun = typeof stageRuns.$inferSelect

const DEFAULT_PAGE = 50

const iso = (date: Date | null) => (date ? date.toISOString() : null)

export function toSong(song: Song): SongOut {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    instrument: song.instrument,
    source_kind: song.sourceKind,
    source_url: song.sourceUrl,
    duration_s: song.durationS,
    status: song.status,
    player_state: song.playerState,
    last_opened_at: iso(song.lastOpenedAt),
    created_at: song.createdAt.toISOString(),
  }
}

function toArtefact(row: Artefact): z.infer<typeof ArtefactIndexEntry> {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    bytes: row.bytes,
    sha256: row.sha256,
    created_at: row.createdAt.toISOString(),
  }
}

// Opaque keyset cursor: the last row's position in the library order.
const Cursor = z.tuple([z.iso.datetime().nullable(), z.iso.datetime(), z.uuid()])

function encodeCursor(song: Song): string {
  const position = [iso(song.lastOpenedAt), song.createdAt.toISOString(), song.id]
  return Buffer.from(JSON.stringify(position)).toString('base64url')
}

function decodeCursor(cursor: string): SongCursor {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    parsed = undefined
  }
  const result = Cursor.safeParse(parsed)
  if (!result.success) {
    throw apiError('invalid_input', {
      details: { issues: [{ path: 'cursor', message: 'Invalid cursor' }] },
    })
  }
  const [lastOpenedAt, createdAt, id] = result.data
  return {
    lastOpenedAt: lastOpenedAt === null ? null : new Date(lastOpenedAt),
    createdAt: new Date(createdAt),
    id,
  }
}

export const songs = {
  create: authed.songs.create.handler(async ({ context, input }) => {
    const song = await context.deps.repos.songs.create(context.userId, {
      // Uploads fill in the title from the file's tags later; this is the placeholder.
      title: input.title ?? 'Untitled',
      artist: input.artist ?? null,
      instrument: input.instrument,
      sourceKind: input.source_kind,
    })
    return { song_id: song.id }
  }),

  list: authed.songs.list.handler(async ({ context, input }) => {
    const limit = input.limit ?? DEFAULT_PAGE
    const rows = await context.deps.repos.songs.list(context.userId, {
      limit: limit + 1,
      ...(input.cursor === undefined ? {} : { after: decodeCursor(input.cursor) }),
    })
    const items = rows.slice(0, limit)
    const last = items.at(-1)
    return {
      items: items.map(toSong),
      next_cursor: rows.length > limit && last ? encodeCursor(last) : null,
    }
  }),

  get: authed.songs.get.handler(async ({ context, input }) => {
    const opened = await context.deps.repos.songs.open(context.userId, input.id)
    if (!opened) throw apiError('not_found')
    const { song, latestAnalysis, stages, artefacts, youtube } = opened
    const artefactIndex = artefacts.map(toArtefact)
    const detail: z.infer<typeof SongDetailSchema> = {
      ...toSong(song),
      latest_analysis: latestAnalysis ? toAnalysis(latestAnalysis, stages, artefactIndex) : null,
      artefacts: artefactIndex,
      youtube: youtube
        ? {
            video_id: youtube.videoId,
            sync_points: youtube.syncPoints.map((p) => ({ audio_s: p.audioS, video_s: p.videoS })),
          }
        : null,
    }
    return detail
  }),

  update: authed.songs.update.handler(async ({ context, input }) => {
    const patch: SongPatch = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.artist !== undefined) patch.artist = input.artist
    if (input.instrument !== undefined) patch.instrument = input.instrument
    // The client owns the whole resume state and sends it complete (debounced).
    if (input.player_state !== undefined) patch.playerState = input.player_state
    const song =
      Object.keys(patch).length > 0
        ? await context.deps.repos.songs.update(context.userId, input.id, patch)
        : await context.deps.repos.songs.get(context.userId, input.id)
    if (!song) throw apiError('not_found')
    return toSong(song)
  }),

  delete: authed.songs.delete.handler(async ({ context, input }) => {
    const { userId } = context
    const deleted = await context.deps.repos.songs.delete(userId, input.id, (objects) => [
      ...objects.uploadIds.map((id) => uploadPrefix(userId, id)),
      ...objects.analysisIds.map((id) => analysisPrefix(userId, id)),
    ])
    if (!deleted) throw apiError('not_found')
  }),
}

function toAnalysis(
  analysis: Analysis,
  stages: StageRun[],
  artefacts: z.infer<typeof ArtefactIndexEntry>[],
): z.infer<typeof AnalysisSchema> {
  return {
    id: analysis.id,
    song_id: analysis.songId,
    version: analysis.version,
    type: analysis.analysisType,
    requested_instrument: analysis.requestedInstrument,
    status: analysis.status,
    progress: analysis.progress,
    pipeline_version: analysis.pipelineVersion,
    stages: Object.fromEntries(
      stages.map((run) => [
        run.stage,
        {
          status: run.status,
          ...(run.startedAt ? { started_at: run.startedAt.toISOString() } : {}),
          ...(run.finishedAt ? { finished_at: run.finishedAt.toISOString() } : {}),
          ...(run.errorCode ? { error_code: run.errorCode } : {}),
        },
      ]),
    ),
    artefacts,
    created_at: analysis.createdAt.toISOString(),
    finished_at: iso(analysis.finishedAt),
  }
}
