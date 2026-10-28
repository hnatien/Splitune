import { SCHEMA_VERSION } from '@splitune/contracts'
import { correctBassOctaves } from './bass/octave.ts'
import { type BandThresholds, confidenceBand, DEFAULT_BANDS } from './calibration/lookup.ts'
import {
  applyBeatCorrections,
  applyChordCorrections,
  applyNoteCorrections,
  type FretPin,
} from './corrections/apply.ts'
import { type AlphaTexNoteRef, toAlphaTex } from './export/alphatex.ts'
import { type FingeringMode, type FretWeights, fretConfig } from './fret/config.ts'
import { assignFrets, type FretStep } from './fret/dp.ts'
import { createBeatGrid, positionOfTick, tickToTime } from './grid/beatgrid.ts'
import { chordDisplayName, parseChord, pcOfName, transposeNoteName } from './harmony/chordtools.ts'
import { keyNoteNames } from './harmony/key.ts'
import { bassRoots, type LevelNote, simplifyChords, simplifyGuitar } from './level/simplify.ts'
import { type QuantizeOptions, quantizeNotes, snapTimeToGrid } from './quantize/quantize.ts'
import { resolveShapes, transposeSegments } from './transpose/transpose.ts'
import type {
  Beats,
  ChordSegment,
  Chords,
  CorrectionOp,
  Notes,
  Tab,
  TabEvent,
  TabLevel,
} from './types.ts'
import { MUSIC_CORE_VERSION } from './version.ts'

// The one entry point the finalize worker and the web Worker both call:
// effective artefacts (corrections) → bass octave fix → transposition → quantize → level →
// fret DP → same-string duration clipping → Tab + alphaTex.

export interface TabCorrections {
  notes?: readonly CorrectionOp[]
  beats?: readonly CorrectionOp[]
  chords?: readonly CorrectionOp[]
  beatsRev?: number // corrections revision of the beat grid, recorded in tab.beats_ref
}

export interface BuildTabOptions {
  chords?: Chords
  tuningMidi?: readonly number[] // default: tabTuning (a confident suggestion, else standard)
  capo?: number
  maxFret?: number
  maxSpan?: number
  fingeringMode?: FingeringMode
  level?: TabLevel
  transpose?: { semitones: number; keepShapes?: boolean }
  bands?: BandThresholds
  weights?: Partial<FretWeights>
  quantize?: QuantizeOptions
  lowBandEnergy?: Readonly<Record<string, number>> // bass octave correction, per note id
  title?: string
  chordNames?: boolean // chord names as alphaTex beat text, "?" after low-confidence ones (default off)
}

export type BuildTabWarning = 'keep_shapes_unavailable' | 'unplayable_notes'

export interface BuildTabResult {
  tab: Tab
  alphaTex: string
  alphaTexFirstBar: number
  noteMap: AlphaTexNoteRef[] // rendered alphaTab note (bar, voice, beat, note) → note id
  effective: { notes: Notes; beats: Beats; chords?: Chords }
  displayChords: ChordSegment[] // labels as shown at this level and playback key
  skippedCorrections: { notes: number[]; beats: number[]; chords: number[] }
  residualFlagged: string[] // note ids whose onset is far from the grid (> 60 ms)
  warnings: BuildTabWarning[]
}

// The notes stage's tuning suggestion (notes.tuning.suggested, 07 §6.1) is used when the caller
// gives no tuning and its confidence reaches this (step 22, services/ml/eval/results/p2g/).
export const TUNING_SUGGESTION_MIN_CONFIDENCE = 0.3
// A note's bend shows in the tab from a quarter tone (alphaTex's bend unit) up to the contract's
// two whole steps.
const MIN_BEND_CENTS = 50
const MAX_BEND_CENTS = 400

// The tab's open strings: the caller's, else a confident suggestion for this instrument's string
// count, else the instrument's standard tuning (undefined).
export function tabTuning(
  notes: Notes,
  tuningMidi?: readonly number[],
): readonly number[] | undefined {
  if (tuningMidi !== undefined) return tuningMidi
  const suggested = notes.tuning?.suggested
  const strings = notes.instrument === 'bass' ? 4 : 6
  if (
    suggested === undefined ||
    suggested.confidence < TUNING_SUGGESTION_MIN_CONFIDENCE ||
    suggested.tuning_midi.length !== strings
  ) {
    return undefined
  }
  return suggested.tuning_midi
}

const GUITAR_LEVELS: readonly TabLevel[] = ['chords_only', 'simplified', 'as_transcribed']
const BASS_LEVELS: readonly TabLevel[] = ['roots', 'full']

interface PlacedNote extends LevelNote {
  pin?: FretPin
  stringProbs?: readonly number[]
  bendCents?: number
  endTime: number
}

function segmentAt(segments: readonly ChordSegment[], t: number): ChordSegment | undefined {
  return segments.find((s) => s.t0 <= t && t < s.t1)
}

export function buildTab(
  notes: Notes,
  beats: Beats,
  corrections: TabCorrections = {},
  options: BuildTabOptions = {},
): BuildTabResult {
  const instrument = notes.instrument
  if (instrument !== 'guitar' && instrument !== 'bass') {
    throw new RangeError(`buildTab supports guitar and bass, not ${instrument}`)
  }
  const level = options.level ?? (instrument === 'bass' ? 'full' : 'as_transcribed')
  if (!(instrument === 'bass' ? BASS_LEVELS : GUITAR_LEVELS).includes(level)) {
    throw new RangeError(`level ${level} is not valid for ${instrument}`)
  }
  const fingeringMode = options.fingeringMode ?? 'easiest'
  const semitones = options.transpose?.semitones ?? 0
  if (!Number.isInteger(semitones) || Math.abs(semitones) > 12) {
    throw new RangeError('transpose.semitones must be an integer in [-12, 12]')
  }
  const bands = options.bands ?? DEFAULT_BANDS
  const warnings: BuildTabWarning[] = []

  const effBeats = applyBeatCorrections(beats, corrections.beats ?? [])
  const grid = createBeatGrid(effBeats.value)
  const effChords =
    options.chords === undefined
      ? undefined
      : applyChordCorrections(options.chords, corrections.chords ?? [])
  const segments = effChords?.value.segments ?? []

  const requestedCapo = options.capo ?? 0
  const shapes = resolveShapes(requestedCapo, semitones, options.transpose?.keepShapes ?? true)
  if (options.transpose?.keepShapes !== false && semitones !== 0 && !shapes.keepShapes) {
    warnings.push('keep_shapes_unavailable')
  }
  const configInput: Parameters<typeof fretConfig>[0] = {
    instrument,
    mode: fingeringMode,
    capo: shapes.capo,
  }
  const tuningMidi = tabTuning(notes, options.tuningMidi)
  if (tuningMidi !== undefined) configInput.tuningMidi = tuningMidi
  if (options.maxFret !== undefined) configInput.maxFret = options.maxFret
  if (options.maxSpan !== undefined) configInput.maxSpan = options.maxSpan
  if (options.weights !== undefined) configInput.weights = options.weights
  const config = fretConfig(configInput)
  const lowest = Math.min(...config.tuningMidi)

  // Octave correction works on model output; the learner's own edits are applied after it.
  const rawNotes =
    instrument === 'bass'
      ? {
          ...notes,
          notes: correctBassOctaves(notes.notes, segments, {
            lowestMidi: lowest,
            highestMidi: Math.max(...config.tuningMidi) + config.maxFret,
            ...(options.lowBandEnergy === undefined
              ? {}
              : { lowBandEnergy: options.lowBandEnergy }),
          }),
        }
      : notes
  const effNotes = applyNoteCorrections(rawNotes, corrections.notes ?? [])

  const quantized = quantizeNotes(effNotes.value.notes, grid, options.quantize)
  const residualFlagged = quantized.notes.filter((q) => q.residualFlagged).map((q) => q.noteId)
  const residualById = new Map(quantized.notes.map((q) => [q.noteId, q.residualMs]))
  const placed: PlacedNote[] = effNotes.value.notes.map((note, i) => {
    const q = quantized.notes[i] as (typeof quantized.notes)[number]
    const out: PlacedNote = {
      id: note.id,
      pitch: note.pitch_midi + semitones,
      confidence: note.confidence,
      onTick: q.onTick,
      offTick: q.offTick,
      endTime: tickToTime(grid, q.offTick),
    }
    const pin = effNotes.pins.get(note.id)
    // Pins and the audio string cue describe the sounding pitch; a transposition invalidates them.
    if (pin !== undefined && semitones === 0) out.pin = pin
    if (note.string_probs !== undefined && semitones === 0) out.stringProbs = note.string_probs
    const bend = Math.max(0, ...(note.bend_cents ?? []).map(([, cents]) => cents))
    if (bend >= MIN_BEND_CENTS) out.bendCents = Math.min(Math.round(bend), MAX_BEND_CENTS)
    return out
  })

  const displayChords = transposeSegments(simplifyChords(segments, level), semitones)
  let levelNotes: PlacedNote[]
  if (level === 'roots') {
    levelNotes = bassRoots(displayChords, grid, placed, { lowest, highest: lowest + 24 }).map(
      (r) => ({
        ...r,
        endTime: tickToTime(grid, r.offTick),
      }),
    )
    for (const r of levelNotes) residualById.set(r.id, 0)
  } else if (instrument === 'guitar') {
    levelNotes = simplifyGuitar(
      placed,
      level as 'chords_only' | 'simplified' | 'as_transcribed',
      bands,
    )
  } else {
    levelNotes = placed
  }

  const byTick = new Map<number, PlacedNote[]>()
  for (const n of levelNotes) byTick.set(n.onTick, [...(byTick.get(n.onTick) ?? []), n])
  const stepTicks = [...byTick.keys()].sort((a, b) => a - b)
  const steps: FretStep[] = stepTicks.map((tick) => {
    const time = tickToTime(grid, tick)
    const chord = segmentAt(displayChords, time)?.label
    const step: FretStep = {
      time,
      notes: (byTick.get(tick) as PlacedNote[])
        .sort((a, b) => b.pitch - a.pitch || a.id.localeCompare(b.id))
        .map((n) => ({
          id: n.id,
          pitch: n.pitch,
          endTime: n.endTime,
          ...(n.pin === undefined ? {} : { pin: n.pin }),
          ...(n.stringProbs === undefined ? {} : { stringProbs: n.stringProbs }),
        })),
    }
    if (chord !== undefined) step.chord = chord
    return step
  })
  const assignments = assignFrets(steps, config)

  const noteById = new Map(levelNotes.map((n) => [n.id, n]))
  const events: TabEvent[] = []
  const nextOnString = new Map<number, number>()
  const clippedOff = new Map<string, number>()
  const flat = assignments.flat()
  if (flat.some((a) => a.unplayable)) warnings.push('unplayable_notes')
  // Walk backwards so each note knows the next onset on its string (a string cannot ring
  // through a new note).
  for (let k = flat.length - 1; k >= 0; k--) {
    const a = flat[k] as (typeof flat)[number]
    const note = noteById.get(a.noteId) as PlacedNote
    let offTick = note.offTick
    if (a.string !== undefined) {
      const next = nextOnString.get(a.string)
      if (next !== undefined && next > note.onTick) offTick = Math.min(offTick, next)
      nextOnString.set(a.string, note.onTick)
    }
    const event: TabEvent = {
      note_id: a.noteId,
      ...positionOfTick(grid, note.onTick),
      duration_ticks: offTick - note.onTick,
      quantize_residual_ms: Math.round((residualById.get(a.noteId) ?? 0) * 10) / 10,
    }
    if (a.string !== undefined && a.fret !== undefined) {
      event.string = a.string
      event.fret = a.fret
    }
    if (a.altFingerings.length > 0) event.alt_fingerings = a.altFingerings
    if (a.unplayable) event.unplayable = true
    if (note.bendCents !== undefined) event.bend_cents = note.bendCents
    events.push(event)
    clippedOff.set(a.noteId, offTick)
  }
  events.reverse()

  const tab: Tab = {
    schema_version: SCHEMA_VERSION,
    artefact: `tab.${instrument}`,
    analysis_id: notes.analysis_id,
    notes_ref: { artefact: notes.artefact, artefact_version: notes.artefact_version },
    beats_ref: {
      artefact_version: beats.artefact_version,
      corrections_rev: corrections.beatsRev ?? 0,
    },
    ppq: 960,
    tuning_midi: [...config.tuningMidi],
    capo: config.capo,
    level,
    fingering_mode: fingeringMode,
    events,
    music_core_version: MUSIC_CORE_VERSION,
  }
  if (quantized.swingBars.length > 0) tab.swing_bars = quantized.swingBars

  const chordMarks: { onTick: number; name: string }[] = []
  // Names follow the song's key (A♭ and B♭7 in E♭ major), moved with the playback transposition.
  const key = effChords?.value.key
  const names =
    key && pcOfName(key.tonic) !== null
      ? keyNoteNames({ mode: key.mode, tonic: transposeNoteName(key.tonic, semitones) })
      : undefined
  for (const segment of displayChords) {
    const parsed = parseChord(segment.label)
    if (parsed === null || parsed.kind !== 'chord') continue
    // A low-confidence chord keeps its "?" above the tab, as on the chord strip (26 §5).
    const unsure = confidenceBand(segment.confidence, bands) === 'low' ? '?' : ''
    const name = chordDisplayName(segment.label, segment.bass, names) + unsure
    if (chordMarks.at(-1)?.name === name) continue
    chordMarks.push({ onTick: snapTimeToGrid(grid, segment.t0, quantized.swingBars), name })
  }
  const tex = toAlphaTex({
    grid,
    tuningMidi: config.tuningMidi,
    capo: config.capo,
    meterDenominator: effBeats.value.meter.denominator,
    tempo: effBeats.value.bpm,
    events: flat.map((a) => {
      const note = noteById.get(a.noteId) as PlacedNote
      return {
        noteId: a.noteId,
        onTick: note.onTick,
        offTick: clippedOff.get(a.noteId) as number,
        ...(a.string === undefined || a.fret === undefined
          ? {}
          : { string: a.string, fret: a.fret }),
        ...(note.bendCents === undefined ? {} : { bendCents: note.bendCents }),
      }
    }),
    chords: chordMarks,
    swingBars: quantized.swingBars,
    trackName: instrument === 'bass' ? 'Bass' : 'Guitar',
    chordNames: options.chordNames ?? false,
    ...(options.title === undefined ? {} : { title: options.title }),
  })

  const effective: BuildTabResult['effective'] = { notes: effNotes.value, beats: effBeats.value }
  if (effChords !== undefined) effective.chords = effChords.value
  return {
    tab,
    alphaTex: tex.tex,
    alphaTexFirstBar: tex.firstBar,
    noteMap: tex.noteMap,
    effective,
    displayChords,
    skippedCorrections: {
      notes: effNotes.skipped,
      beats: effBeats.skipped,
      chords: effChords?.skipped ?? [],
    },
    residualFlagged,
    warnings,
  }
}
