import { z } from 'zod'
import { Instrument, SourceKind } from '../analysis/common.ts'
import { RecommendedView } from '../analysis/summary.ts'
import { Analysis, AnalysisAccepted, AnalysisType } from './analyses.ts'
import { ArtefactIndexEntry } from './artefacts.ts'

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
