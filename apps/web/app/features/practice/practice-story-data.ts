import type { Analysis, SongDetail } from '@splitune/contracts'
import beats from '@splitune/contracts/fixtures/beats.json'
import chords from '@splitune/contracts/fixtures/chords.json'
import notes from '@splitune/contracts/fixtures/notes.guitar.json'
import stems from '@splitune/contracts/fixtures/stems.json'
import summary from '@splitune/contracts/fixtures/summary.json'
import type { QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { orpc } from '@/lib/api'
import { meQuery } from '@/lib/session'
import { statsQuery, workerStatusQuery } from '../library/queries'
import { analysis, detail, ME, STATS, WORKER_ONLINE } from '../story-fixtures'
import type { FetchAudio } from './practice-context'

// Story data for the practice screen (Screens/Practice, Screens/Onboarding): the contracts'
// 8-bar Am–F–C–G fixture as a song whose artefacts land kind by kind, and a generated tone for
// its audio. Nothing reaches the network.

export type Kind =
  | 'beats'
  | 'stems'
  | 'chords'
  | 'notes.guitar'
  | 'tab.guitar'
  | 'summary'
  | 'notes.piano'
/** Every artefact of the guitar song. */
export const ALL: Kind[] = ['beats', 'stems', 'chords', 'notes.guitar', 'tab.guitar', 'summary']
const IDS: Kind[] = [...ALL, 'notes.piano']
export const artefactId = (kind: Kind) =>
  `00000000-0000-4000-9000-${String(IDS.indexOf(kind) + 1).padStart(12, '0')}`

export type Patch = {
  summary?: unknown
  chords?: unknown
  running?: boolean
  /** The sweeper removed the stems' audio (15 §3). */
  stemsPurged?: boolean
  /** A stage that failed and fell back (27 §3.7.3 "Failed stage"). */
  failedStage?: string
  /** A URL import with its downloaded video (13 §6a); an empty clip, so nothing is fetched. */
  video?: boolean
  /** The learner's part, when not the fixture's guitar. */
  instrument?: 'piano'
}

// A piano song on the same 8 bars (4/4, bar n from 0.5 + 2.4 n s): E♭ major as the chord model
// labels it, with sharps (D#:maj7), so the chart's key spelling shows. An N.C. bar, a change on
// beat 3 (an unsure A#:7) and a slash-free run of E♭maj7 over two bars.
const BAR = (n: number, beat = 0) => Math.round((0.5 + n * 2.4 + beat * 0.6) * 10) / 10
const PIANO_SEGMENTS: [string, number, number, number][] = [
  ['N', 0, BAR(1), 0.9],
  ['D#:maj7', BAR(1), BAR(2), 0.9],
  ['G#:maj7', BAR(2), BAR(2, 2), 0.88],
  ['A#:7', BAR(2, 2), BAR(3), 0.2],
  ['D#:maj7', BAR(3), BAR(5), 0.92],
  ['G#:min7', BAR(5), BAR(5, 2), 0.6],
  ['B:maj7', BAR(5, 2), BAR(6), 0.8],
  ['F:min7', BAR(6), BAR(7), 0.9],
  ['G#:maj', BAR(7), 20.5, 0.9],
]
// The piano part over those chords, as notes.piano: the left hand's bass on beats 1 and 3, the
// right hand's chord on each half bar, a melody over the N.C. bar and bar 4. The unsure B♭7 half
// bar is low confidence, the G♯m7 one medium.
type PianoBeat = [bar: number, beat: number, beats: number, pitches: number[], confidence?: number]
const PIANO_PART: PianoBeat[] = [
  [0, 0, 1, [67]],
  [0, 1, 1, [70]],
  [0, 2, 1, [75]],
  [0, 3, 1, [74]],
  [1, 0, 2, [39, 55, 58, 62]],
  [1, 2, 2, [46, 55, 58, 62]],
  [2, 0, 2, [44, 56, 60, 63]],
  [2, 2, 2, [46, 56, 58, 62], 0.3],
  [3, 0, 2, [39, 55, 58, 62]],
  [3, 2, 1, [46, 70]],
  [3, 3, 1, [72]],
  [4, 0, 4, [39, 55, 58, 62]],
  [5, 0, 2, [44, 59, 63, 66], 0.55],
  [5, 2, 2, [47, 58, 63, 66]],
  [6, 0, 2, [41, 56, 60, 63]],
  [6, 2, 2, [48, 56, 60, 63]],
  [7, 0, 4, [44, 56, 60, 63]],
]
export const PIANO_NOTES = {
  ...notes,
  artefact: 'notes.piano',
  instrument: 'piano',
  models: [{ ...notes.models[0], model_id: 'transkun/2.0', version: '2.0.1' }],
  params: { calibration: { bands: { high: 0.7, medium: 0.4 } } },
  notes: PIANO_PART.flatMap(([bar, beat, beats, pitches, confidence = 0.92], i) =>
    pitches.map((pitch_midi, k) => ({
      id: `p${String(i * 8 + k).padStart(6, '0')}`,
      onset_s: BAR(bar, beat),
      offset_s: BAR(bar, beat + beats) - 0.05,
      pitch_midi,
      velocity: 72,
      confidence,
      confidence_raw: 1,
      stem_id: 'piano',
    })),
  ),
}
const pianoSummary = (view: 'roll' | 'chords_only') => ({
  ...summary,
  per_instrument: [
    {
      instrument: 'piano',
      note_confidence_mean: 0.85,
      fraction_low_conf: 0.12,
      recommended_view: view,
      reasons: view === 'roll' ? [] : ['quality_gate_failed'],
    },
  ],
})
/** A piano song whose notes passed the quality gate (the falling notes by default), or not. */
export const PIANO_SUMMARY = pianoSummary('roll')
export const PIANO_SUMMARY_BELOW_GATE = pianoSummary('chords_only')

export const DOCS: Partial<Record<Kind, unknown>> = {
  beats,
  stems,
  chords,
  'notes.guitar': notes,
  summary,
  'notes.piano': PIANO_NOTES,
}

export const PIANO_CHORDS = {
  ...chords,
  key: { tonic: 'D#', mode: 'major', confidence: 0.74 },
  segments: PIANO_SEGMENTS.map(([label, t0, t1, confidence], i) => ({
    id: `p${String(i).padStart(4, '0')}`,
    confidence,
    t0,
    t1,
    label,
    top_k: [{ label, prob: confidence }],
    beat_aligned: true,
  })),
}

export function seed(kinds: Kind[], patch: Patch = {}) {
  return (client: QueryClient) => {
    const base = analysis(1, patch.running ? 'running' : 'done')
    // The fixture's stages are the guitar song's: another part has its own notes stage.
    const done = patch.instrument
      ? {
          ...base,
          requested_instrument: patch.instrument,
          stages: Object.fromEntries(
            Object.entries(base.stages).map(([stage, state]) => [
              stage === 'notes.guitar' ? `notes.${patch.instrument}` : stage,
              state,
            ]),
          ),
        }
      : base
    const failed = patch.failedStage
      ? { ...done, stages: { ...done.stages, [patch.failedStage]: { status: 'failed' as const } } }
      : done
    const run = patch.video
      ? { ...failed, stages: { ...failed.stages, url_import: { status: 'done' as const } } }
      : failed
    const entries = kinds.map((kind) => ({
      id: artefactId(kind),
      kind,
      version: 1,
      bytes: 100,
      sha256: '0'.repeat(64),
      created_at: '2026-10-22T10:00:00Z',
      purged_at: kind === 'stems' && patch.stemsPurged ? '2026-10-01T03:30:00Z' : null,
    }))
    const withArtefacts: z.infer<typeof Analysis> = { ...run, artefacts: entries }
    const song: z.infer<typeof SongDetail> = {
      ...detail(1, withArtefacts),
      ...(patch.video ? { source_kind: 'url' as const } : {}),
      ...(patch.instrument ? { instrument: patch.instrument } : {}),
      duration_s: 20.5,
      artefacts: entries,
    }
    if (patch.video) {
      client.setQueryData(orpc.songs.mediaUrl.queryKey({ input: { id: song.id, kind: 'video' } }), {
        url: 'data:video/mp4,',
        expires_at: '2026-10-22T10:15:00Z',
      })
    }
    client.setQueryData(orpc.songs.get.queryKey({ input: { id: song.id } }), song)
    client.setQueryData(orpc.analyses.get.queryKey({ input: { id: run.id } }), withArtefacts)
    client.setQueryData(orpc.loops.list.queryKey({ input: { id: song.id } }), { items: [] })
    client.setQueryData(statsQuery.queryKey, STATS)
    client.setQueryData(workerStatusQuery.queryKey, WORKER_ONLINE)
    client.setQueryData(meQuery.queryKey, ME)
    for (const kind of kinds) {
      client.setQueryData(
        orpc.artefacts.listCorrections.queryKey({ input: { id: artefactId(kind) } }),
        { ops: [] },
      )
      const doc =
        kind === 'summary' && patch.summary
          ? patch.summary
          : kind === 'chords' && patch.chords
            ? patch.chords
            : DOCS[kind]
      if (doc) client.setQueryData(['artefact-doc', artefactId(kind)], doc)
    }
  }
}

// 20.5 s of a quiet plucked 220 Hz tone as a WAV, for every stem and the song's own audio.
export function toneWav(): ArrayBuffer {
  const rate = 22_050
  const frames = Math.round(20.5 * rate)
  const buffer = new ArrayBuffer(44 + frames * 2)
  const view = new DataView(buffer)
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, frames * 2, true)
  for (let i = 0; i < frames; i++) {
    const t = i / rate
    const sample = 0.3 * Math.exp(-3 * ((t + 0.1) % 0.6)) * Math.sin(2 * Math.PI * 220 * t)
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true)
  }
  return buffer
}

export const tone: FetchAudio = async () => toneWav()

export const SONG_ID = detail(1, null).id
