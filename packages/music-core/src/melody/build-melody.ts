import { type BandThresholds, confidenceBand, DEFAULT_BANDS } from '../calibration/lookup.ts'
import {
  applyBeatCorrections,
  applyChordCorrections,
  applyNoteCorrections,
} from '../corrections/apply.ts'
import {
  type BeatGrid,
  createBeatGrid,
  PPQ,
  positionOfTick,
  tickToTime,
  timeToTick,
} from '../grid/beatgrid.ts'
import type { Beats, Chords, CorrectionOp, Notes } from '../types.ts'

// The vocal counterpart of buildTab and buildPianoScore (step 18c), called by the web Worker:
// effective artefacts (corrections), then the sung notes on their own timing (not quantized: a
// singer's phrasing is the point) split into phrases. Phrases need no lyrics and no model: a run
// of notes ends at a rest of ¾ beat or more (0.6 s at least), and a run longer than four bars
// splits at its largest gap. Repeats get the same letter (A, B, A′…), matched by pitch class so an
// octave slip in the transcription still matches.

export interface MelodyCorrections {
  notes?: readonly CorrectionOp[]
  beats?: readonly CorrectionOp[]
  chords?: readonly CorrectionOp[]
}

export interface BuildMelodyOptions {
  chords?: Chords
  bands?: BandThresholds
}

export interface MelodyNote {
  id: string
  pitch: number // MIDI
  t0: number // seconds on the decoded-PCM timeline
  t1: number
  confidence: number
  band: 'high' | 'medium' | 'low'
}

export interface MelodyPhrase {
  /** First and last note (indices into Melody.notes, inclusive). */
  from: number
  to: number
  t0: number
  t1: number
  /** Bars it touches (grid bar indices, pickup = -1): a phrase loop covers them. */
  startBar: number
  endBar: number
  /** The note to pitch from: the first one that isn't low confidence (else the first). */
  first: number
  /** "A", "B"…: phrases with the same melody share a letter. */
  letter: string
  /** An earlier phrase has this letter (shown A′). */
  repeat: boolean
}

export interface Melody {
  notes: MelodyNote[] // by onset
  phrases: MelodyPhrase[]
  /** 5th–95th percentile of the notes that aren't low confidence; null without any. */
  range: { low: number; high: number } | null
  effective: { notes: Notes; beats: Beats; chords?: Chords }
  skippedCorrections: { notes: number[]; beats: number[]; chords: number[] }
}

/** A rest this long (or longer) ends a phrase: ¾ of the beat there, and never under 0.6 s. */
export const PHRASE_REST = { beats: 0.75, minS: 0.6 }
/** Longer phrases split at their largest gap. */
export const PHRASE_MAX_BARS = 4

function beatAt(grid: BeatGrid, t: number): number {
  const tick = timeToTick(grid, t)
  return tickToTime(grid, tick + PPQ) - tickToTime(grid, tick)
}

const barAt = (grid: BeatGrid, t: number) => positionOfTick(grid, timeToTick(grid, t)).bar

/** Groups notes (by onset) into phrases: index ranges [from, to]. */
export function phraseRuns(notes: readonly MelodyNote[], grid: BeatGrid): [number, number][] {
  const runs: [number, number][] = []
  // The end of everything sung so far in the current run.
  let end = 0
  notes.forEach((note, i) => {
    const last = runs.at(-1)
    if (last && note.t0 - end < Math.max(PHRASE_REST.minS, PHRASE_REST.beats * beatAt(grid, end))) {
      last[1] = i
      end = Math.max(end, note.t1)
    } else {
      runs.push([i, i])
      end = note.t1
    }
  })
  const maxTicks = PHRASE_MAX_BARS * grid.beatsPerBar * PPQ
  const split = ([from, to]: [number, number]): [number, number][] => {
    const a = notes[from] as MelodyNote
    const b = notes[to] as MelodyNote
    if (to - from < 3 || timeToTick(grid, b.t1) - timeToTick(grid, a.t0) <= maxTicks) {
      return [[from, to]]
    }
    // The largest gap from the end of everything sung so far to the next onset.
    let at = from + 1
    let best = Number.NEGATIVE_INFINITY
    let sung = a.t1
    for (let i = from + 1; i <= to; i++) {
      const note = notes[i] as MelodyNote
      if (i >= from + 2 && i <= to - 1 && note.t0 - sung > best) {
        best = note.t0 - sung
        at = i
      }
      sung = Math.max(sung, note.t1)
    }
    return [...split([from, at - 1]), ...split([at, to])]
  }
  return runs.flatMap(split)
}

function letterOf(n: number): string {
  let out = ''
  let k = n
  do {
    out = String.fromCharCode(65 + (k % 26)) + out
    k = Math.floor(k / 26) - 1
  } while (k >= 0)
  return out
}

/** Same melody: as many notes give or take one, and at most one pitch class differs. */
export function sameMelody(a: readonly number[], b: readonly number[]): boolean {
  const k = Math.min(a.length, b.length)
  if (k < 4 || Math.abs(a.length - b.length) > 1) return false
  let misses = 0
  for (let i = 0; i < k; i++) if (a[i] !== b[i]) misses++
  return misses <= 1
}

function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] as number
}

export function buildMelody(
  notes: Notes,
  beats: Beats,
  corrections: MelodyCorrections = {},
  options: BuildMelodyOptions = {},
): Melody {
  if (notes.instrument !== 'vocals') {
    throw new RangeError(`buildMelody supports vocals, not ${notes.instrument}`)
  }
  const bands = options.bands ?? DEFAULT_BANDS
  const effBeats = applyBeatCorrections(beats, corrections.beats ?? [])
  const grid = createBeatGrid(effBeats.value)
  const effChords =
    options.chords === undefined
      ? undefined
      : applyChordCorrections(options.chords, corrections.chords ?? [])
  const effNotes = applyNoteCorrections(notes, corrections.notes ?? [])
  const out: MelodyNote[] = effNotes.value.notes
    .map((note) => ({
      id: note.id,
      pitch: note.pitch_midi,
      t0: note.onset_s,
      t1: Math.max(note.offset_s, note.onset_s),
      confidence: note.confidence,
      band: confidenceBand(note.confidence, bands),
    }))
    .sort((a, b) => a.t0 - b.t0 || a.pitch - b.pitch)

  const shapes: number[][] = []
  const letters: string[] = []
  let next = 0
  const phrases = phraseRuns(out, grid).map(([from, to]): MelodyPhrase => {
    const run = out.slice(from, to + 1)
    const shape = run.map((n) => n.pitch % 12)
    const twin = shapes.findIndex((s) => sameMelody(s, shape))
    const letter = twin >= 0 ? (letters[twin] as string) : letterOf(next++)
    shapes.push(shape)
    letters.push(letter)
    const t1 = run.reduce((max, n) => Math.max(max, n.t1), 0)
    const sure = run.findIndex((n) => n.band !== 'low')
    return {
      from,
      to,
      t0: (out[from] as MelodyNote).t0,
      t1,
      startBar: barAt(grid, (out[from] as MelodyNote).t0),
      // A phrase ending exactly on a bar line doesn't reach into the next bar.
      endBar: barAt(grid, Math.max((out[from] as MelodyNote).t0, t1 - 1e-3)),
      first: from + Math.max(0, sure),
      letter,
      repeat: twin >= 0,
    }
  })

  const sung = out
    .filter((n) => n.band !== 'low')
    .map((n) => n.pitch)
    .sort((a, b) => a - b)
  const effective: Melody['effective'] = { notes: effNotes.value, beats: effBeats.value }
  if (effChords !== undefined) effective.chords = effChords.value
  return {
    notes: out,
    phrases,
    range: sung.length > 0 ? { low: percentile(sung, 0.05), high: percentile(sung, 0.95) } : null,
    effective,
    skippedCorrections: {
      notes: effNotes.skipped,
      beats: effBeats.skipped,
      chords: effChords?.skipped ?? [],
    },
  }
}
