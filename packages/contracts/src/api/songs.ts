import { z } from 'zod'
import { Instrument, SourceKind } from '../analysis/common.ts'
import { RecommendedView } from '../analysis/summary.ts'
import {
  Analysis,
  AnalysisAccepted,
  AnalysisKind,
  AnalysisStatus,
  AnalysisType,
} from './analyses.ts'
import { ArtefactIndexEntry } from './artefacts.ts'
import { PageInput } from './common.ts'

export const SongStatus = z.enum([
  'importing',
  'analysing',
  'ready',
  'partial',
  'failed',
  'taken_down',
])

export const StemMix = z.object({
  gain_db: z.number().min(-60).max(12),
  muted: z.boolean(),
  solo: z.boolean(),
})

// Resume state (13-import-onboarding-and-youtube-embed.md §5); the client debounces PATCHes.
export const PlayerState = z.object({
  speed_pct: z.number().int().min(25).max(200).optional(),
  mix: z.record(z.string(), StemMix).optional(), // key = stem_id
  playback_key_semitones: z.number().int().min(-12).max(12).optional(),
  view: RecommendedView.optional(),
  position_s: z.number().nonnegative().optional(),
  selected_loop_id: z.uuid().nullable().optional(),
})

export const Song = z.object({
  id: z.uuid(),
  title: z.string(),
  artist: z.string().nullable(),
  instrument: Instrument,
  source_kind: SourceKind,
  source_url: z.url().nullable(),
  duration_s: z.number().nonnegative().nullable(),
  status: SongStatus,
  player_state: PlayerState,
  last_opened_at: z.iso.datetime().nullable(),
  created_at: z.iso.datetime(),
})

// Library query (27-screens-flows-and-content.md §3.5): title search, filter chips and sort. The
// `analysing` chip covers songs still importing (URL download) or analysing.
export const LibrarySort = z.enum(['last_practised', 'added', 'title'])
export const LibraryStatusFilter = z.enum(['ready', 'partial', 'analysing', 'failed'])

export const ListSongsInput = PageInput.extend({
  q: z.string().trim().min(1).max(200).optional(),
  instrument: Instrument.optional(),
  status: LibraryStatusFilter.optional(),
  sort: LibrarySort.optional(),
})

// What a library card shows besides the song: the latest analysis' progress (stages finished of
// those planned, reused stages included) and the view finalize recommended ("Chords only"), whether
// its stems can still be played, and the best clean tempo of any clip with that clip's bars
// (0-based bar_index, 05 "indexing").
export const LibraryAnalysis = z.object({
  id: z.uuid(),
  type: AnalysisKind,
  status: AnalysisStatus,
  stages_done: z.number().int().nonnegative(),
  stages_total: z.number().int().nonnegative(),
  recommended_view: RecommendedView.nullable(),
})

export const BestClean = z.object({
  tempo_pct: z.number().int().min(1).max(200),
  start_bar: z.number().int(),
  end_bar: z.number().int(),
})

export const LibrarySong = Song.extend({
  latest_analysis: LibraryAnalysis.nullable(),
  stems: z.enum(['available', 'expired', 'none']),
  best_clean: BestClean.nullable(),
})

export const SyncPoint = z.object({
  audio_s: z.number().nonnegative(),
  video_s: z.number().nonnegative(),
})

export const YoutubeVideoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/)

export const SongDetail = Song.extend({
  latest_analysis: Analysis.nullable(),
  artefacts: z.array(ArtefactIndexEntry),
  youtube: z.object({ video_id: YoutubeVideoId, sync_points: z.array(SyncPoint) }).nullable(),
})

// URL songs are created by import-url and example songs by onboarding, never through this call.
export const CreateSongInput = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  artist: z.string().trim().min(1).max(200).optional(),
  instrument: Instrument,
  source_kind: z.enum(['upload', 'recording']),
})

export const CreateSongOutput = z.object({ song_id: z.uuid() })

export const UpdateSongInput = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  artist: z.string().trim().min(1).max(200).nullable().optional(),
  instrument: Instrument.optional(),
  player_state: PlayerState.optional(),
})

export const ImportUrlInput = z.object({
  url: z.url({ protocol: /^https?$/ }),
  instrument: Instrument,
  type: AnalysisType,
  download_video: z.boolean().optional(),
})

// Download progress and errors (url_unsupported, url_download_failed) arrive on the analysis SSE stream.
export const ImportUrlOutput = AnalysisAccepted.extend({ song_id: z.uuid() })

export const PutYoutubeInput = z.object({ id: z.uuid(), video_id: YoutubeVideoId })

export const PutSyncPointsInput = z.object({
  id: z.uuid(),
  sync_points: z.array(SyncPoint).max(500),
})
