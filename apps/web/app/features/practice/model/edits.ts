import {
  applyChordCorrections,
  applyNoteCorrections,
  type Beats,
  type Chords,
  type Note,
  type Notes,
} from '@splitune/music-core'
import type { Op } from './corrections'

// Editor operations (27 §3.7.4) as correction ops with their inverses, computed from the effective
// view the edit started from. The overlay is append-only, so undo appends the inverse.

export interface Edit {
  kind: 'chords' | 'notes' | 'beats'
  op: Op
  inverse: Op | null
}

type Segment = Chords['segments'][number]

export function setChord(segment: Segment, label: string): Edit {
  const inverse: Op = { op: 'set_chord', segment_id: segment.id, label: segment.label }
  if (segment.bass !== undefined) inverse.bass = segment.bass
  return { kind: 'chords', op: { op: 'set_chord', segment_id: segment.id, label }, inverse }
}

// music-core names the new tail `${id}.${n}` with the first free n (applyChordCorrections).
export function splitChord(
  segment: Segment,
  segments: readonly Segment[],
  atSeconds: number,
  label: string,
): Edit {
  const taken = new Set(segments.map((s) => s.id))
  let n = 1
  while (taken.has(`${segment.id}.${n}`)) n++
  return {
    kind: 'chords',
    op: { op: 'split_chord', segment_id: segment.id, at_s: atSeconds, label },
    // Not a merge, but it sounds and reads the same: the tail gets the original chord back.
    inverse: { op: 'set_chord', segment_id: `${segment.id}.${n}`, label: segment.label },
  }
}

export interface Placement {
  string: number
  fret: number
}

/** Moves a note to another fret (its pitch follows) or string (its pitch stays). */
export function placeNote(
  note: Note,
  from: Placement,
  to: Placement,
  tuningMidi: readonly number[],
): Edit | null {
  const open = tuningMidi[to.string - 1]
  if (open === undefined || to.fret < 0 || to.fret > 24) return null
  const pitch = open + to.fret
  if (pitch < 21 || pitch > 108) return null
  return {
    kind: 'notes',
    op: {
      op: 'set_note',
      note_id: note.id,
      patch: { pitch_midi: pitch, string: to.string, fret: to.fret },
    },
    inverse: {
      op: 'set_note',
      note_id: note.id,
      patch: { pitch_midi: note.pitch_midi, string: from.string, fret: from.fret },
    },
  }
}

export function setNoteEnd(note: Note, offsetSeconds: number): Edit | null {
  if (offsetSeconds <= note.onset_s) return null
  return {
    kind: 'notes',
    op: { op: 'set_note', note_id: note.id, patch: { offset_s: offsetSeconds } },
    inverse: { op: 'set_note', note_id: note.id, patch: { offset_s: note.offset_s } },
  }
}

export function deleteNote(note: Note): Edit {
  const { confidence: _c, confidence_raw: _r, low_band_energy: _e, ...rest } = note
  return {
    kind: 'notes',
    op: { op: 'delete_note', note_id: note.id },
    inverse: { op: 'add_note', note: rest },
  }
}

export function reportWrong(kind: Edit['kind'], entityId: string): Edit {
  return { kind, op: { op: 'report_wrong', entity_id: entityId }, inverse: null }
}

/** One-tap metronome fixes (12 §5, `practice.beat_off`). */
export function beatFix(fix: 'half' | 'double' | 'shift'): Edit {
  if (fix === 'shift') {
    return {
      kind: 'beats',
      op: { op: 'shift_downbeat', by_beats: 1 },
      inverse: { op: 'shift_downbeat', by_beats: -1 },
    }
  }
  return {
    kind: 'beats',
    op: { op: 'tempo_octave', factor: fix },
    inverse: { op: 'tempo_octave', factor: fix === 'half' ? 'double' : 'half' },
  }
}

/**
 * The op that undoes `ops[index]` given the artefact it applies to (corrections history "Revert",
 * 27 §3.8): the state just before it is replayed from the base. Null when there is nothing to
 * undo (reports) or the target no longer exists.
 */
export function revertOp(
  kind: Edit['kind'],
  base: Chords | Notes | Beats,
  ops: readonly Op[],
  index: number,
): Op | null {
  const op = ops[index]
  if (!op) return null
  const before = ops.slice(0, index)
  switch (op.op) {
    case 'set_chord':
    case 'split_chord': {
      if (kind !== 'chords') return null
      const state = applyChordCorrections(base as Chords, before).value.segments
      const segment = state.find((s) => s.id === op.segment_id)
      if (!segment) return null
      return op.op === 'set_chord'
        ? setChord(segment, segment.label).op
        : splitChord(segment, state, op.at_s, op.label).inverse
    }
    case 'set_note': {
      if (kind !== 'notes') return null
      const applied = applyNoteCorrections(base as Notes, before)
      const note = applied.value.notes.find((n) => n.id === op.note_id)
      if (!note) return null
      const patch: Extract<Op, { op: 'set_note' }>['patch'] = {}
      if (op.patch.pitch_midi !== undefined) patch.pitch_midi = note.pitch_midi
      if (op.patch.onset_s !== undefined) patch.onset_s = note.onset_s
      if (op.patch.offset_s !== undefined) patch.offset_s = note.offset_s
      const pin = applied.pins.get(note.id)
      if (pin && op.patch.string !== undefined) {
        patch.string = pin.string
        patch.fret = pin.fret
      }
      return { op: 'set_note', note_id: note.id, patch }
    }
    case 'delete_note': {
      if (kind !== 'notes') return null
      const note = applyNoteCorrections(base as Notes, before).value.notes.find(
        (n) => n.id === op.note_id,
      )
      return note ? deleteNote(note).inverse : null
    }
    case 'add_note':
      return { op: 'delete_note', note_id: op.note.id }
    case 'shift_downbeat':
      return { op: 'shift_downbeat', by_beats: -op.by_beats }
    case 'tempo_octave':
      return { op: 'tempo_octave', factor: op.factor === 'double' ? 'half' : 'double' }
    case 'nudge_beat':
      return { op: 'nudge_beat', beat_id: op.beat_id, delta_s: -op.delta_s }
    default:
      return null
  }
}
