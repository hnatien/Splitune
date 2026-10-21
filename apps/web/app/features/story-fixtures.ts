import type {
  Analysis,
  LibrarySong,
  SongDetail,
  SystemStats,
  WorkerStatus,
} from '@splitune/contracts'
import type { z } from 'zod'
import type { MeData } from '@/lib/session'

// Story data for the feature screens (28 §2: realistic content — long titles, every status).

type Song = z.infer<typeof LibrarySong>

export const ME: MeData = {
  id: 'user-story',
  email: 'ana@splitune.localhost',
  display_name: 'Ana',
  primary_instrument: 'guitar',
  level: 'few_songs',
  handedness: 'right',
  training_opt_in: false,
  marketing_opt_in: false,
  plan: 'free',
  subscription: null,
  usage: {
    welcome_available: true,
    full: { used: 0, cap: 1, resets_at: null },
    lite: { used: 1, cap: 5, resets_at: '2026-12-01T00:00:00Z' },
  },
  entitlements: ['practice.core', 'analysis.welcome', 'analysis.lite'],
  flags: {},
}

export const ME_CAPPED: MeData = {
  ...ME,
  usage: {
    welcome_available: false,
    full: { used: 1, cap: 1, resets_at: null },
    lite: { used: 5, cap: 5, resets_at: '2026-12-01T00:00:00Z' },
  },
  entitlements: ['practice.core'],
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

function song(
  n: number,
  patch: Partial<Song>,
  analysis?: Partial<NonNullable<Song['latest_analysis']>>,
): Song {
  return {
    id: id(n),
    title: 'Untitled',
    artist: null,
    instrument: 'guitar',
    source_kind: 'upload',
    source_url: null,
    duration_s: 214,
    status: 'ready',
    player_state: {},
    last_opened_at: null,
    created_at: daysAgo(n),
    latest_analysis:
      analysis === undefined
        ? null
        : {
            id: id(100 + n),
            type: 'full',
            status: 'done',
            stages_done: 9,
            stages_total: 9,
            recommended_view: 'tab',
            ...analysis,
          },
    stems: 'available',
    best_clean: null,
    ...patch,
  }
}

export const LIBRARY: Song[] = [
  song(
    1,
    {
      title: 'Riff in A minor',
      last_opened_at: daysAgo(0),
      best_clean: { tempo_pct: 85, start_bar: 16, end_bar: 19 },
    },
    {},
  ),
  song(
    2,
    { title: 'Walking bass in F', instrument: 'bass', status: 'analysing' },
    { status: 'running', stages_done: 3, stages_total: 8 },
  ),
  song(
    3,
    { title: 'Campfire strumming', status: 'analysing' },
    { status: 'queued', stages_done: 0, stages_total: 8 },
  ),
  song(
    4,
    { title: 'Ballad with a capo', last_opened_at: daysAgo(3) },
    { recommended_view: 'chords_only' },
  ),
  song(
    5,
    {
      title:
        'Indie Rock - Breathe In Breathe Out (Official Video) [Live at the Old Mill, Remastered 2026 Edition]',
      source_kind: 'url',
      status: 'partial',
      last_opened_at: daysAgo(12),
    },
    { status: 'partial' },
  ),
  song(6, { title: 'Old practice take', stems: 'expired', last_opened_at: daysAgo(200) }, {}),
  song(
    7,
    { title: 'Corrupted voice memo', status: 'failed' },
    { status: 'failed', stages_done: 1, stages_total: 8 },
  ),
  song(8, { title: 'Song from the bus', status: 'importing' }),
]

const at = (secondsAgo: number) =>
  new Date(Date.now() - secondsAgo * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')

export function analysis(
  n: number,
  status: 'running' | 'queued' | 'failed' | 'done',
): z.infer<typeof Analysis> {
  const done = { status: 'done' as const, started_at: at(60), finished_at: at(50) }
  const stages: z.infer<typeof Analysis>['stages'] =
    status === 'done'
      ? Object.fromEntries(
          [
            'decode',
            'beats',
            'tag',
            'separate',
            'stem_post',
            'chords',
            'notes.guitar',
            'finalize',
          ].map((s) => [s, done]),
        )
      : status === 'failed'
        ? {
            decode: { status: 'failed', error_code: 'unsupported_media' },
            beats: { status: 'skipped' },
            finalize: { status: 'skipped' },
          }
        : status === 'queued'
          ? Object.fromEntries(
              [
                'decode',
                'beats',
                'tag',
                'separate',
                'stem_post',
                'chords',
                'notes.guitar',
                'finalize',
              ].map((s) => [s, { status: 'pending' as const }]),
            )
          : {
              decode: done,
              beats: done,
              tag: done,
              separate:
                status === 'running'
                  ? { status: 'running', started_at: at(40) }
                  : { status: 'pending' },
              stem_post: { status: 'pending' },
              chords: { status: 'pending' },
              'notes.guitar': { status: 'pending' },
              finalize: { status: 'pending' },
            }
  return {
    id: id(100 + n),
    song_id: id(n),
    version: 1,
    type: 'full',
    requested_instrument: 'guitar',
    status: status === 'done' ? 'done' : status === 'failed' ? 'failed' : status,
    progress: 0.4,
    pipeline_version: 'dev',
    stages,
    artefacts: [],
    created_at: at(120),
    finished_at: status === 'done' || status === 'failed' ? at(5) : null,
  }
}

export function detail(
  n: number,
  run: z.infer<typeof Analysis> | null,
): z.infer<typeof SongDetail> {
  const entry = LIBRARY[n - 1]
  if (!entry) throw new Error(`no library fixture ${n}`)
  const { latest_analysis: _latest, stems: _stems, best_clean: _best, ...base } = entry
  return { ...base, latest_analysis: run, artefacts: [], youtube: null }
}

export const STATS: z.infer<typeof SystemStats> = {
  stages: [
    { stage: 'decode', median_s: 2, runs: 20 },
    { stage: 'beats', median_s: 4, runs: 20 },
    { stage: 'tag', median_s: 6, runs: 20 },
    { stage: 'separate', median_s: 150, runs: 20 },
    { stage: 'stem_post', median_s: 10, runs: 20 },
    { stage: 'chords', median_s: 9, runs: 20 },
    { stage: 'notes.guitar', median_s: 4, runs: 20 },
    { stage: 'finalize', median_s: 1, runs: 20 },
  ],
}

export const WORKER_ONLINE: z.infer<typeof WorkerStatus> = {
  online: true,
  runners: {
    python: { online: true, last_heartbeat_at: at(10) },
    node: { online: true, last_heartbeat_at: at(10) },
  },
}

export const WORKER_OFFLINE: z.infer<typeof WorkerStatus> = {
  online: false,
  runners: {
    python: { online: false, last_heartbeat_at: at(3600) },
    node: { online: false, last_heartbeat_at: at(3600) },
  },
}
