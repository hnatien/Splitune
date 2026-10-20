import { nudgeBeat, shiftDownbeat, tempoOctave } from '../grid/beatgrid.ts'
import type {
  Beats,
  ChordSegment,
  Chords,
  CorrectionOp,
  Note,
  Notes,
  SectionSegment,
  Sections,
} from '../types.ts'

// Effective view = artefact ⊕ ops applied in `rev` order (05-analysis-schema.md "Corrections
// overlay"). Ops for another artefact kind are ignored; ops whose target entity does not exist
// (deleted earlier, or from another artefact version) are reported in `skipped` by index.
// User-edited entities get confidence 1: the learner's correction is not uncertain.

export interface FretPin {
  string: number
  fret: number
}

export interface Applied<T> {
  value: T
  skipped: number[]
}

export interface AppliedNotes extends Applied<Notes> {
  pins: ReadonlyMap<string, FretPin>
}

const NO_PINS: ReadonlyMap<string, FretPin> = new Map()

export function applyNoteCorrections(notes: Notes, ops: readonly CorrectionOp[]): AppliedNotes {
  if (ops.length === 0) return { value: notes, skipped: [], pins: NO_PINS }
  const byId = new Map<string, Note>(notes.notes.map((n) => [n.id, n]))
  const pins = new Map<string, FretPin>()
  const skipped: number[] = []
  ops.forEach((op, index) => {
    switch (op.op) {
      case 'set_note': {
        const note = byId.get(op.note_id)
        if (note === undefined) {
          skipped.push(index)
          return
        }
        const { pitch_midi, onset_s, offset_s, string, fret } = op.patch
        if (pitch_midi !== undefined || onset_s !== undefined || offset_s !== undefined) {
          const onset = onset_s ?? note.onset_s
          byId.set(note.id, {
            ...note,
            pitch_midi: pitch_midi ?? note.pitch_midi,
            onset_s: onset,
            offset_s: Math.max(onset, offset_s ?? note.offset_s),
            confidence: 1,
          })
        }
        if (string !== undefined && fret !== undefined) pins.set(note.id, { string, fret })
        return
      }
      case 'add_note': {
        if (byId.has(op.note.id)) {
          skipped.push(index)
          return
        }
        byId.set(op.note.id, {
          ...op.note,
          offset_s: Math.max(op.note.onset_s, op.note.offset_s),
          confidence: 1,
        })
        return
      }
      case 'delete_note': {
        if (!byId.delete(op.note_id)) skipped.push(index)
        pins.delete(op.note_id)
        return
      }
      default:
        return
    }
  })
  return { value: { ...notes, notes: [...byId.values()] }, skipped, pins }
}

function uniqueId(base: string, taken: ReadonlySet<string>): string {
  let n = 1
  while (taken.has(`${base}.${n}`)) n++
  return `${base}.${n}`
}

export function applyChordCorrections(
  chords: Chords,
  ops: readonly CorrectionOp[],
): Applied<Chords> {
  if (ops.length === 0) return { value: chords, skipped: [] }
  let segments: ChordSegment[] = [...chords.segments]
  const skipped: number[] = []
  ops.forEach((op, index) => {
    if (op.op === 'set_chord') {
      const i = segments.findIndex((s) => s.id === op.segment_id)
      const segment = segments[i]
      if (segment === undefined) {
        skipped.push(index)
        return
      }
      const { bass: _bass, ...rest } = segment
      const updated: ChordSegment = { ...rest, label: op.label, confidence: 1 }
      if (op.bass !== undefined) updated.bass = op.bass
      segments = segments.with(i, updated)
    } else if (op.op === 'split_chord') {
      const i = segments.findIndex((s) => s.id === op.segment_id)
      const segment = segments[i]
      if (segment === undefined || op.at_s <= segment.t0 || op.at_s >= segment.t1) {
        skipped.push(index)
        return
      }
      const { bass: _bass, ...rest } = segment
      const tail: ChordSegment = {
        ...rest,
        id: uniqueId(segment.id, new Set(segments.map((s) => s.id))),
        t0: op.at_s,
        label: op.label,
        confidence: 1,
        top_k: [],
      }
      segments = [
        ...segments.slice(0, i),
        { ...segment, t1: op.at_s },
        tail,
        ...segments.slice(i + 1),
      ]
    }
  })
  return { value: { ...chords, segments }, skipped }
}

export function applyBeatCorrections(beats: Beats, ops: readonly CorrectionOp[]): Applied<Beats> {
  if (ops.length === 0) return { value: beats, skipped: [] }
  let value = beats
  const skipped: number[] = []
  ops.forEach((op, index) => {
    if (op.op === 'shift_downbeat') value = shiftDownbeat(value, op.by_beats)
    else if (op.op === 'tempo_octave') value = tempoOctave(value, op.factor)
    else if (op.op === 'nudge_beat') {
      const nudged = nudgeBeat(value, op.beat_id, op.delta_s)
      if (nudged === null) skipped.push(index)
      else value = nudged
    }
  })
  return { value, skipped }
}

export function applySectionCorrections(
  sections: Sections,
  ops: readonly CorrectionOp[],
): Applied<Sections> {
  if (ops.length === 0) return { value: sections, skipped: [] }
  let segments: SectionSegment[] = [...sections.segments]
  const skipped: number[] = []
  ops.forEach((op, index) => {
    if (op.op !== 'set_section') return
    const i = segments.findIndex((s) => s.id === op.segment_id)
    const segment = segments[i]
    if (segment === undefined) skipped.push(index)
    else segments = segments.with(i, { ...segment, label: op.label })
  })
  return { value: { ...sections, segments }, skipped }
}

type Correctable = Notes | Chords | Beats | Sections

// Generic entry point: dispatches on the artefact kind and returns the effective artefact.
export function applyCorrections<T extends Correctable>(
  artefact: T,
  ops: readonly CorrectionOp[],
): T
export function applyCorrections(artefact: Correctable, ops: readonly CorrectionOp[]): Correctable {
  if (artefact.artefact === 'beats') return applyBeatCorrections(artefact as Beats, ops).value
  if (artefact.artefact === 'chords') return applyChordCorrections(artefact as Chords, ops).value
  if (artefact.artefact === 'sections') {
    return applySectionCorrections(artefact as Sections, ops).value
  }
  return applyNoteCorrections(artefact as Notes, ops).value
}
