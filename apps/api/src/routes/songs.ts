import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import type {
  LibrarySong as LibrarySongSchema,
  SongDetail as SongDetailSchema,
  Song as SongSchema,
} from '@splitune/contracts'
import {
  type LibraryCursor,
  type LibraryEntry,
  type LibrarySort,
  libraryCursor,
  type Song,
  type SongPatch,
} from '@splitune/db'
import { analysisPrefix, GET_TTL_S, uploadPrefix } from '@splitune/storage'
import { z } from 'zod'
import { admitAnalysis, reserving } from '../admission.ts'
import { apiError } from '../errors.ts'
import { analysisKey, CONFIG_PROFILE, planAnalysis } from '../pipeline.ts'
import { authed, userRateLimit } from '../procedures.ts'
import { artefactIndex, recordRequested, toAnalysis } from './analyses.ts'

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

type LibrarySongOut = z.infer<typeof LibrarySongSchema>

const toLibrarySong = (entry: LibraryEntry): LibrarySongOut => ({
  ...toSong(entry.song),
  latest_analysis: entry.latestAnalysis && {
    id: entry.latestAnalysis.id,
    type: entry.latestAnalysis.type,
    status: entry.latestAnalysis.status,
    stages_done: entry.latestAnalysis.stagesDone,
    stages_total: entry.latestAnalysis.stagesTotal,
    recommended_view: entry.latestAnalysis.recommendedView,
  },
  stems: entry.stems,
  best_clean: entry.bestClean && {
    tempo_pct: entry.bestClean.tempoPct,
    start_bar: entry.bestClean.startBar,
    end_bar: entry.bestClean.endBar,
  },
})

// Opaque keyset cursor: the sort it belongs to and the last row's position in that order.
const Cursor = z.discriminatedUnion('sort', [
  z.object({
    sort: z.literal('last_practised'),
    at: z.tuple([z.iso.datetime().nullable(), z.iso.datetime(), z.uuid()]),
  }),
  z.object({ sort: z.literal('added'), at: z.tuple([z.iso.datetime(), z.uuid()]) }),
  z.object({ sort: z.literal('title'), at: z.tuple([z.string(), z.uuid()]) }),
])

function encodeCursor(cursor: LibraryCursor): string {
  const at =
    cursor.sort === 'last_practised'
      ? [iso(cursor.lastOpenedAt), cursor.createdAt.toISOString(), cursor.id]
      : cursor.sort === 'added'
        ? [cursor.createdAt.toISOString(), cursor.id]
        : [cursor.title, cursor.id]
  return Buffer.from(JSON.stringify({ sort: cursor.sort, at })).toString('base64url')
}

function decodeCursor(cursor: string, sort: LibrarySort): LibraryCursor {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    parsed = undefined
  }
  const result = Cursor.safeParse(parsed)
  // A cursor only continues the order it came from.
  if (!result.success || result.data.sort !== sort) {
    throw apiError('invalid_input', {
      details: { issues: [{ path: 'cursor', code: 'invalid_cursor' }] },
    })
  }
  const value = result.data
  switch (value.sort) {
    case 'last_practised': {
      const [lastOpenedAt, createdAt, id] = value.at
      return {
        sort: value.sort,
        lastOpenedAt: lastOpenedAt === null ? null : new Date(lastOpenedAt),
        createdAt: new Date(createdAt),
        id,
      }
    }
    case 'added':
      return { sort: value.sort, createdAt: new Date(value.at[0]), id: value.at[1] }
    case 'title':
      return { sort: value.sort, title: value.at[0], id: value.at[1] }
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

  // Library (27 §3.5): search, filter chips and sort, with what each card shows.
  list: authed.songs.list.handler(async ({ context, input }) => {
    const limit = input.limit ?? DEFAULT_PAGE
    const sort = input.sort ?? 'last_practised'
    const rows = await context.deps.repos.songs.library(context.userId, {
      limit: limit + 1,
      sort,
      ...(input.q === undefined ? {} : { q: input.q }),
      ...(input.instrument === undefined ? {} : { instrument: input.instrument }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.cursor === undefined ? {} : { after: decodeCursor(input.cursor, sort) }),
    })
    const items = rows.slice(0, limit)
    const last = items.at(-1)
    return {
      items: items.map(toLibrarySong),
      next_cursor:
        rows.length > limit && last ? encodeCursor(libraryCursor(sort, last.song)) : null,
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

  // The song's own audio (original upload or download) or a URL import's video (13 §6a).
  mediaUrl: authed.songs.mediaUrl.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const found = await deps.repos.analyses.source(userId, input.id)
    const source = found?.source
    if (!source || source.kind === 'url_pending') throw apiError('not_found')
    const key =
      input.kind === 'source' ? source.rawKey : source.kind === 'url' ? source.videoKey : undefined
    if (key === undefined || !(await deps.storage.exists(key))) throw apiError('not_found')
    const expiresAt = new Date(Date.now() + GET_TTL_S * 1000)
    return { url: await deps.storage.presignGet(key), expires_at: expiresAt.toISOString() }
  }),

  // URL import (25 §4): the song (source_kind url, placeholder title until the download names it)
  // and its analysis, url_import first, in one transaction. Progress and the download's errors
  // (url_unsupported, url_download_failed, too_long, file_too_large) arrive on the analysis' SSE
  // stream.
  importUrl: authed
    .use(userRateLimit('analyses'))
    .songs.importUrl.handler(async ({ context, input }) => {
      const { deps, userId } = context
      // Kill switch (16 §5): the client shows "Link import is temporarily broken".
      if (!(await deps.flags.flag('import.url'))) {
        throw apiError('url_unsupported', { details: { reason: 'import_disabled' } })
      }
      if (!importable(input.url)) throw apiError('url_unsupported')
      const drums = await deps.flags.flag('v1.drums')
      const admission = await admitAnalysis(deps, userId, input.type)
      const importId = randomUUID()
      const created = await reserving(admission, () =>
        deps.repos.analyses.createWithSong(
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
              drums,
            }),
          admission.charge,
        ),
      )
      await recordRequested(deps, userId, {
        type: admission.kind,
        instrument: input.instrument,
        source: 'link',
      })
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
