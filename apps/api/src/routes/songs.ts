import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import type { SongDetail as SongDetailSchema, Song as SongSchema } from '@splitune/contracts'
import type { Song, SongCursor, SongPatch } from '@splitune/db'
import { analysisPrefix, uploadPrefix } from '@splitune/storage'
import { z } from 'zod'
import { admitAnalysis } from '../entitlements.ts'
import { apiError } from '../errors.ts'
import { analysisKey, CONFIG_PROFILE, planAnalysis } from '../pipeline.ts'
import { authed, userRateLimit } from '../procedures.ts'
import { artefactIndex, toAnalysis } from './analyses.ts'

type SongOut = z.infer<typeof SongSchema>

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
      details: { issues: [{ path: 'cursor', code: 'invalid_cursor' }] },
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
    const { repos } = context.deps
    const opened = await repos.songs.open(context.userId, input.id)
    if (!opened) throw apiError('not_found')
    const { song, latestAnalysis, youtube } = opened
    const latest = latestAnalysis
      ? await repos.analyses.detail(context.userId, latestAnalysis.id)
      : undefined
    const detail: z.infer<typeof SongDetailSchema> = {
      ...toSong(song),
      latest_analysis: latest ? toAnalysis(latest) : null,
      artefacts: latest ? artefactIndex(latest) : [],
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

  // URL import (25 §4): the song (source_kind url, placeholder title until the download names it)
  // and its analysis, url_import first, in one transaction. Progress and the download's errors
  // (url_unsupported, url_download_failed, too_long, file_too_large) arrive on the analysis' SSE
  // stream.
  importUrl: authed
    .use(userRateLimit('analyses'))
    .songs.importUrl.handler(async ({ context, input }) => {
      const { deps, userId } = context
      if (!importable(input.url)) throw apiError('url_unsupported')
      const admission = await admitAnalysis(deps, userId, input.type)
      const importId = randomUUID()
      const created = await deps.repos.analyses.createWithSong(
        userId,
        {
          title: 'Untitled',
          sourceKind: 'url',
          sourceUrl: input.url,
          instrument: input.instrument,
        },
        {
          pipelineVersion: deps.config.pipelineVersion,
          configProfile: CONFIG_PROFILE,
          requestedInstrument: input.instrument,
          analysisType: admission.kind,
          // Every import makes a new song, so the import itself is the source.
          idempotencyKey: analysisKey([userId, `url:${importId}`, input.instrument, input.type]),
        },
        (analysis) =>
          planAnalysis({
            userId,
            analysis,
            type: input.type,
            source: { download: { importId, video: input.download_video ?? true } },
            priority: admission.priority,
          }),
      )
      return {
        song_id: created.song.id,
        analysis_id: created.analysis.id,
        status: created.analysis.status,
      }
    }),
}

// The worker only uses site-specific extractors, so a URL naming an address or a local host can
// never be imported; refusing it here also keeps the Mac from fetching its own network.
function importable(raw: string): boolean {
  const host = new URL(raw).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(host) !== 0 || !host.includes('.')) return false
  return !['.local', '.localhost', '.internal', '.lan', '.home.arpa'].some((s) => host.endsWith(s))
}
