import chords from '@splitune/contracts/fixtures/chords.json'
import notes from '@splitune/contracts/fixtures/notes.guitar.json'
import {
  applyChordCorrections,
  applyNoteCorrections,
  type Chords,
  type Notes,
} from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { beatFix, deleteNote, placeNote, revertOp, setChord, setNoteEnd, splitChord } from './edits'

const segments = (chords as Chords).segments
const F = segments.find((s) => s.id === 'c0002') as Chords['segments'][number]
const note = (notes as Notes).notes[0] as Notes['notes'][number]
const STANDARD = [64, 59, 55, 50, 45, 40]

const roundTrip = (edit: { op: unknown; inverse: unknown }) => [edit.op, edit.inverse]

describe('editor ops', () => {
  it('sets a chord and undoes back to the label it had', () => {
    const edit = setChord(F, 'D:min')
    const [op, inverse] = roundTrip(edit) as Parameters<typeof applyChordCorrections>[1]
    const after = applyChordCorrections(chords as Chords, [op as never]).value
    expect(after.segments.find((s) => s.id === 'c0002')?.label).toBe('D:min')
    const undone = applyChordCorrections(chords as Chords, [op as never, inverse as never]).value
    expect(undone.segments.find((s) => s.id === 'c0002')?.label).toBe('F:maj')
  })

  it('splits a chord and the inverse targets the tail music-core creates', () => {
    const edit = splitChord(F, segments, 7.7, 'G:maj')
    const applied = applyChordCorrections(chords as Chords, [
      edit.op as never,
      edit.inverse as never,
    ])
    expect(applied.skipped).toEqual([])
    const tail = applied.value.segments.find((s) => s.id === 'c0002.1')
    expect(tail?.label).toBe('F:maj')
    expect(tail?.t0).toBe(7.7)
  })

  it('moves a note by fret (pitch follows) and by string (pitch stays)', () => {
    const higher = placeNote(note, { string: 5, fret: 0 }, { string: 5, fret: 2 }, STANDARD)
    expect(higher?.op).toEqual({
      op: 'set_note',
      note_id: note.id,
      patch: { pitch_midi: 47, string: 5, fret: 2 },
    })
    const across = placeNote(note, { string: 5, fret: 0 }, { string: 6, fret: 5 }, STANDARD)
    expect(across?.op).toMatchObject({ patch: { pitch_midi: 45 } })
    expect(placeNote(note, { string: 5, fret: 0 }, { string: 5, fret: -1 }, STANDARD)).toBeNull()
  })

  it('deletes a note and undoes it with the same note', () => {
    const edit = deleteNote(note)
    const notesDoc = notes as Notes
    const gone = applyNoteCorrections(notesDoc, [edit.op as never]).value
    expect(gone.notes.some((n) => n.id === note.id)).toBe(false)
    const back = applyNoteCorrections(notesDoc, [edit.op as never, edit.inverse as never]).value
    expect(back.notes.find((n) => n.id === note.id)?.pitch_midi).toBe(note.pitch_midi)
  })

  it('shortens a note but never below its onset', () => {
    expect(setNoteEnd(note, note.onset_s + 0.1)?.op).toMatchObject({
      patch: { offset_s: note.onset_s + 0.1 },
    })
    expect(setNoteEnd(note, note.onset_s)).toBeNull()
  })

  it('pairs the beat fixes with their inverses', () => {
    expect(beatFix('half').inverse).toEqual({ op: 'tempo_octave', factor: 'double' })
    expect(beatFix('shift').inverse).toEqual({ op: 'shift_downbeat', by_beats: -1 })
  })
})

describe('reverting one op from the history', () => {
  it('restores the chord it replaced, even after later edits', () => {
    const ops = [setChord(F, 'D:min').op, setChord(F, 'G:maj').op]
    expect(revertOp('chords', chords as Chords, ops, 0)).toEqual({
      op: 'set_chord',
      segment_id: 'c0002',
      label: 'F:maj',
    })
    expect(revertOp('chords', chords as Chords, ops, 1)).toMatchObject({ label: 'D:min' })
  })

  it('brings a deleted note back and deletes an added one', () => {
    const del = deleteNote(note)
    const reverted = revertOp('notes', notes as Notes, [del.op], 0)
    expect(reverted).toMatchObject({ op: 'add_note', note: { id: note.id } })
    expect(revertOp('notes', notes as Notes, [del.inverse as never], 0)).toEqual({
      op: 'delete_note',
      note_id: note.id,
    })
  })

  it('restores a note’s earlier pitch and has nothing to undo for a report', () => {
    const moved = placeNote(note, { string: 5, fret: 0 }, { string: 5, fret: 2 }, STANDARD)
    expect(revertOp('notes', notes as Notes, [moved?.op as never], 0)).toEqual({
      op: 'set_note',
      note_id: note.id,
      patch: { pitch_midi: note.pitch_midi },
    })
    expect(
      revertOp('notes', notes as Notes, [{ op: 'report_wrong', entity_id: note.id }], 0),
    ).toBeNull()
  })
})
