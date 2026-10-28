import { readFileSync } from 'node:fs'
import type {
  Beat,
  Beats,
  Chords,
  CorrectionOp,
  DrumHit,
  DrumNotes,
  Note,
  Notes,
} from '../src/types.ts'

const FIXTURES = new URL('../../contracts/fixtures/', import.meta.url)

export function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), 'utf8')) as T
}

export const fixtures = {
  beats: () => fixture<Beats>('beats'),
  notes: () => fixture<Notes>('notes.guitar'),
  chords: () => fixture<Chords>('chords'),
  corrections: () => fixture<CorrectionOp[]>('corrections'),
  drums: () => fixture<DrumNotes>('notes.drums'),
}

const HEADER = {
  schema_version: '1.1.0',
  artefact_version: 1,
  analysis_id: '0192f6c4-8b00-7a00-8000-0000000000aa',
  user_id: 'usr_test',
  audio_hash: 'a'.repeat(64),
  sample_rate: 44100 as const,
  models: [],
  params: {},
  created_at: '2026-10-20T12:00:00Z',
}

// Constant-tempo beats; `pickup` beats precede the first downbeat.
export function makeBeats(
  options: {
    bpm?: number
    bars?: number
    numerator?: number
    start?: number
    pickup?: number
  } = {},
): Beats {
  const bpm = options.bpm ?? 120
  const numerator = options.numerator ?? 4
  const pickup = options.pickup ?? 0
  const count = (options.bars ?? 4) * numerator + pickup
  const period = 60 / bpm
  const start = options.start ?? 0.5
  const beats: Beat[] = Array.from({ length: count }, (_, i) => {
    const k = i - pickup
    const inPickup = k < 0
    return {
      id: `b${String(i).padStart(4, '0')}`,
      t: Math.round((start + i * period) * 1e6) / 1e6,
      activation: 0.9,
      is_downbeat: !inPickup && k % numerator === 0,
      bar_index: inPickup ? -1 : Math.floor(k / numerator),
      beat_in_bar: inPickup ? numerator + k + 1 : (k % numerator) + 1,
    }
  })
  return {
    ...HEADER,
    artefact: 'beats',
    duration_s: start + count * period + 1,
    beats,
    bpm,
    meter: { numerator, denominator: 4 },
    tempo_octave_ambiguous: false,
    first_downbeat_t: beats[pickup]?.t ?? start,
  }
}

export function makeNotes(
  notes: Partial<Note>[],
  instrument: 'guitar' | 'bass' | 'piano' | 'vocals' = 'guitar',
): Notes {
  return {
    ...HEADER,
    artefact: `notes.${instrument}`,
    instrument,
    duration_s: Math.max(1, ...notes.map((n) => (n.offset_s ?? 0) + 1)),
    notes: notes.map((n, i) => ({
      id: n.id ?? `n${String(i).padStart(6, '0')}`,
      onset_s: n.onset_s ?? 0,
      offset_s: n.offset_s ?? (n.onset_s ?? 0) + 0.25,
      pitch_midi: n.pitch_midi ?? 60,
      confidence: n.confidence ?? 0.9,
      stem_id: instrument,
    })),
  }
}

export function makeChords(
  segments: { t0: number; t1: number; label: string; confidence?: number }[],
): Chords {
  return {
    ...HEADER,
    artefact: 'chords',
    duration_s: Math.max(1, ...segments.map((s) => s.t1)),
    vocabulary: 'majmin',
    segments: segments.map((s, i) => ({
      id: `c${String(i).padStart(4, '0')}`,
      t0: s.t0,
      t1: s.t1,
      label: s.label,
      confidence: s.confidence ?? 0.9,
      top_k: [],
      beat_aligned: true,
    })),
    key: { tonic: 'C', mode: 'major', confidence: 0.5 },
    inputs_fused: ['mixture'],
  }
}

// Deterministic PRNG (mulberry32) so synthetic parts are identical on every run.
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PROGRESSION = [
  { label: 'G:maj', voicing: [43, 47, 50, 55, 59, 67] },
  { label: 'E:min', voicing: [40, 47, 52, 55, 59, 64] },
  { label: 'C:maj', voicing: [48, 52, 55, 60, 64] },
  { label: 'D:maj', voicing: [50, 57, 62, 66] },
]

// Dense 4-minute guitar part at 120 bpm: per beat a strummed chord (onsets spread over 20 ms)
// and three sixteenth-note melody notes with ±20 ms timing jitter. ~480 beats, ~4.3k notes.
export function denseGuitarPart(seed = 7): { notes: Notes; beats: Beats; chords: Chords } {
  const random = rng(seed)
  const beats = makeBeats({ bpm: 120, bars: 120, start: 0.5 })
  const period = 0.5
  const notes: Partial<Note>[] = []
  const segments: { t0: number; t1: number; label: string }[] = []
  for (let bar = 0; bar < 120; bar++) {
    const chord = PROGRESSION[bar % PROGRESSION.length] as (typeof PROGRESSION)[number]
    const barStart = 0.5 + bar * 4 * period
    segments.push({ t0: barStart, t1: barStart + 4 * period, label: chord.label })
    for (let beat = 0; beat < 4; beat++) {
      const t = barStart + beat * period
      chord.voicing.forEach((pitch, k) => {
        notes.push({
          onset_s: t + k * 0.004,
          offset_s: t + period * 0.45,
          pitch_midi: pitch,
          confidence: 0.5 + random() * 0.5,
        })
      })
      for (let s = 1; s < 4; s++) {
        const onset = t + (s * period) / 4 + (random() - 0.5) * 0.04
        const pitch =
          (chord.voicing.at(-1) as number) + ([0, 2, 3, 5, 7][Math.floor(random() * 5)] as number)
        notes.push({
          onset_s: onset,
          offset_s: onset + period / 4,
          pitch_midi: pitch,
          confidence: random(),
        })
      }
    }
  }
  return { notes: makeNotes(notes), beats, chords: makeChords(segments) }
}

const CLASS: Record<number, DrumHit['class5']> = {
  36: 'kick',
  38: 'snare',
  42: 'hihat',
  46: 'hihat',
  43: 'toms',
  47: 'toms',
  50: 'toms',
  49: 'cymbals',
  51: 'cymbals',
}

// notes.drums from [gm, onset_s] rows; hi-hat, tom and cymbal hits are flagged approximate as a
// 5-class transcriber would.
export function makeDrums(rows: readonly (readonly [number, number])[]): DrumNotes {
  return {
    ...HEADER,
    artefact: 'notes.drums',
    instrument: 'drums',
    duration_s: Math.max(1, ...rows.map(([, t]) => t + 1)),
    hits: rows.map(([gm, t], i) => {
      const class5 = CLASS[gm] ?? 'snare'
      return {
        id: `d${String(i).padStart(6, '0')}`,
        onset_s: Math.round(t * 1e6) / 1e6,
        class5,
        gm_note: gm,
        approximate: class5 !== 'kick' && class5 !== 'snare',
        confidence: 0.9,
      }
    }),
  }
}

// A drum song at 120 bpm (beats every 0.5 s, bar 0 at 1.0 s): a pickup of snare 16ths, a crash
// on bar 0, a rock groove with 16th hi-hats in bars 0-2, swung eighths in bars 4-6 (a snare flam
// in bar 5) and a fill (snare and toms) in every fourth bar (3 and 7).
export function drumSong(): { drums: DrumNotes; beats: Beats } {
  const rows: [number, number][] = []
  const bar = (b: number) => 1 + b * 2
  for (let k = 0; k < 4; k++) rows.push([38, 0.5 + k * 0.125])
  rows.push([49, bar(0)])
  for (let b = 0; b < 8; b++) {
    const t = bar(b)
    if (b === 3 || b === 7) {
      rows.push([36, t])
      for (let k = 0; k < 8; k++) rows.push([38, t + k * 0.125])
      for (let k = 0; k < 4; k++) rows.push([47, t + 1 + k * 0.125])
      for (let k = 0; k < 4; k++) rows.push([43, t + 1.5 + k * 0.125])
      continue
    }
    rows.push([36, t], [36, t + 1], [38, t + 0.5], [38, t + 1.5])
    const swung = b >= 4
    for (let beat = 0; beat < 4; beat++) {
      const offsets = swung ? [0, 2 / 3] : [0, 0.25, 0.5, 0.75]
      for (const o of offsets) rows.push([42, t + beat * 0.5 + o * 0.5])
    }
    if (b === 5) rows.push([38, t + 0.5 - 0.015])
  }
  return { drums: makeDrums(rows), beats: makeBeats({ bpm: 120, bars: 8, pickup: 1, start: 0.5 }) }
}
