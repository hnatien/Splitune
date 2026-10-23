import { type BandThresholds, confidenceBand, DEFAULT_BANDS } from '../calibration/lookup.ts'
import {
  applyBeatCorrections,
  applyChordCorrections,
  applyNoteCorrections,
} from '../corrections/apply.ts'
import { type PianoNoteRef, toPianoAlphaTex } from '../export/alphatex-piano.ts'
import { createBeatGrid, tickToTime } from '../grid/beatgrid.ts'
import { type QuantizeOptions, quantizeNotes } from '../quantize/quantize.ts'
import type { Beats, Chords, CorrectionOp, Notes } from '../types.ts'
import { type Hand, type HandSplitOptions, splitHands } from './hands.ts'

// The piano counterpart of buildTab (21 V4), called by the web Worker: effective artefacts
// (corrections) → quantize → one sounding note per key at a time → hand split. The result is
// renderer-independent: a falling-notes roll reads the times, the grand staff its alphaTex.

export interface PianoCorrections {
  notes?: readonly CorrectionOp[]
  beats?: readonly CorrectionOp[]
  chords?: readonly CorrectionOp[]
}

export interface BuildPianoOptions {
  chords?: Chords
  bands?: BandThresholds
  quantize?: QuantizeOptions
  hands?: HandSplitOptions
  title?: string
}

export interface PianoNote {
  id: string
  pitch: number // MIDI
  hand: Hand
  onTick: number // global ticks of the beat grid (grid/beatgrid.ts)
  offTick: number
  t0: number // onTick and offTick in seconds on the decoded-PCM timeline
  t1: number
  confidence: number
  band: 'high' | 'medium' | 'low'
  residualFlagged: boolean // onset far from the grid (> 60 ms)
}

export interface PianoScore {
  notes: PianoNote[] // by onset, then pitch
  swingBars: number[]
  alphaTex: string // the grand staff (export/alphatex-piano.ts)
  alphaTexFirstBar: number
  noteMap: PianoNoteRef[] // rendered alphaTab note (staff, bar, voice, beat, note) → note id
  effective: { notes: Notes; beats: Beats; chords?: Chords }
  skippedCorrections: { notes: number[]; beats: number[]; chords: number[] }
}

export function buildPianoScore(
  notes: Notes,
  beats: Beats,
  corrections: PianoCorrections = {},
  options: BuildPianoOptions = {},
): PianoScore {
  if (notes.instrument !== 'piano') {
    throw new RangeError(`buildPianoScore supports piano, not ${notes.instrument}`)
  }
  const bands = options.bands ?? DEFAULT_BANDS
  const effBeats = applyBeatCorrections(beats, corrections.beats ?? [])
  const grid = createBeatGrid(effBeats.value)
  const effChords =
    options.chords === undefined
      ? undefined
      : applyChordCorrections(options.chords, corrections.chords ?? [])
  const effNotes = applyNoteCorrections(notes, corrections.notes ?? [])
  const source = effNotes.value.notes
  const quantized = quantizeNotes(source, grid, options.quantize)

  // A key sounds once at a time: a note ends where the next one on the same key starts.
  const order = source
    .map((_, i) => i)
    .sort(
      (a, b) =>
        (quantized.notes[a]?.onTick as number) - (quantized.notes[b]?.onTick as number) ||
        (source[a]?.pitch_midi as number) - (source[b]?.pitch_midi as number) ||
        a - b,
    )
  const offTicks = quantized.notes.map((q) => q.offTick)
  const nextOnKey = new Map<number, number>()
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k] as number
    const pitch = (source[i] as Notes['notes'][number]).pitch_midi
    const onTick = (quantized.notes[i] as (typeof quantized.notes)[number]).onTick
    const next = nextOnKey.get(pitch)
    if (next !== undefined && next > onTick) offTicks[i] = Math.min(offTicks[i] as number, next)
    nextOnKey.set(pitch, onTick)
  }

  const hands = splitHands(
    source.map((n, i) => ({
      id: n.id,
      pitch: n.pitch_midi,
      onTick: (quantized.notes[i] as (typeof quantized.notes)[number]).onTick,
    })),
    options.hands,
  )
  const out = order.map((i): PianoNote => {
    const note = source[i] as Notes['notes'][number]
    const q = quantized.notes[i] as (typeof quantized.notes)[number]
    const offTick = offTicks[i] as number
    return {
      id: note.id,
      pitch: note.pitch_midi,
      hand: hands.get(note.id) ?? 'right',
      onTick: q.onTick,
      offTick,
      t0: tickToTime(grid, q.onTick),
      t1: tickToTime(grid, offTick),
      confidence: note.confidence,
      band: confidenceBand(note.confidence, bands),
      residualFlagged: q.residualFlagged,
    }
  })

  const tex = toPianoAlphaTex({
    grid,
    meterDenominator: effBeats.value.meter.denominator,
    tempo: effBeats.value.bpm,
    notes: out.map((n) => ({
      noteId: n.id,
      pitch: n.pitch,
      hand: n.hand,
      onTick: n.onTick,
      offTick: n.offTick,
    })),
    swingBars: quantized.swingBars,
    ...(effChords === undefined ? {} : { key: effChords.value.key }),
    ...(options.title === undefined ? {} : { title: options.title }),
  })

  const effective: PianoScore['effective'] = { notes: effNotes.value, beats: effBeats.value }
  if (effChords !== undefined) effective.chords = effChords.value
  return {
    notes: out,
    swingBars: quantized.swingBars,
    alphaTex: tex.tex,
    alphaTexFirstBar: tex.firstBar,
    noteMap: tex.noteMap,
    effective,
    skippedCorrections: {
      notes: effNotes.skipped,
      beats: effBeats.skipped,
      chords: effChords?.skipped ?? [],
    },
  }
}
