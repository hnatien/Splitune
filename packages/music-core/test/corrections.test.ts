import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  applyBeatCorrections,
  applyChordCorrections,
  applyCorrections,
  applyNoteCorrections,
  applySectionCorrections,
} from '../src/index.ts'
import type { Sections } from '../src/types.ts'
import { fixture, fixtures, makeNotes } from './helpers.ts'

describe('applyCorrections', () => {
  it('is the identity for an empty op list (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            onset_s: fc.double({ min: 0, max: 100, noNaN: true }),
            pitch_midi: fc.integer({ min: 21, max: 108 }),
          }),
        ),
        (raw) => {
          const notes = makeNotes(raw)
          expect(applyCorrections(notes, [])).toBe(notes)
          expect(applyCorrections(notes, [])).toStrictEqual(makeNotes(raw))
        },
      ),
    )
    for (const artefact of [fixtures.beats(), fixtures.chords(), fixture<Sections>('sections')]) {
      expect(applyCorrections(artefact, [])).toBe(artefact)
    }
  })

  it('applies note ops in order and pins fingerings', () => {
    const ops = fixtures.corrections()
    const { value, pins, skipped } = applyNoteCorrections(fixtures.notes(), ops)
    const ids = value.notes.map((n) => n.id)
    expect(ids).not.toContain('n000027')
    expect(ids).toContain('u000001')
    expect(value.notes.find((n) => n.id === 'n000013')).toMatchObject({
      pitch_midi: 57,
      confidence: 1,
    })
    expect(pins.get('n000013')).toEqual({ string: 3, fret: 2 })
    expect(skipped).toEqual([])
  })

  it('reports ops whose target no longer exists instead of failing', () => {
    const { skipped } = applyNoteCorrections(fixtures.notes(), [
      { op: 'delete_note', note_id: 'n000001' },
      { op: 'set_note', note_id: 'n000001', patch: { pitch_midi: 40 } },
      {
        op: 'add_note',
        note: { id: 'n000002', onset_s: 1, offset_s: 2, pitch_midi: 50, stem_id: 'guitar' },
      },
    ])
    expect(skipped).toEqual([1, 2])
  })

  it('keeps offset ≥ onset when a patch moves the onset past it', () => {
    const notes = makeNotes([{ id: 'a', onset_s: 1, offset_s: 1.2 }])
    const { value } = applyNoteCorrections(notes, [
      { op: 'set_note', note_id: 'a', patch: { onset_s: 2 } },
    ])
    expect(value.notes[0]).toMatchObject({ onset_s: 2, offset_s: 2 })
  })

  it('sets and splits chords', () => {
    const { value, skipped } = applyChordCorrections(fixtures.chords(), fixtures.corrections())
    const set = value.segments.find((s) => s.id === 'c0004')
    expect(set).toMatchObject({ label: 'G:maj', bass: 'B', confidence: 1 })
    const split = value.segments.filter((s) => s.id.startsWith('c0003'))
    expect(split.map((s) => [s.id, s.label])).toEqual([
      ['c0003', expect.any(String)],
      ['c0003.1', 'E:min'],
    ])
    expect(split[0]?.t1).toBe(12.5)
    expect(split[1]?.t0).toBe(12.5)
    expect(skipped).toEqual([])
  })

  it('ignores a split outside the segment', () => {
    const chords = fixtures.chords()
    const first = chords.segments[0]
    const { skipped } = applyChordCorrections(chords, [
      {
        op: 'split_chord',
        segment_id: first?.id ?? '',
        at_s: (first?.t1 ?? 0) + 1,
        label: 'C:maj',
      },
    ])
    expect(skipped).toEqual([0])
  })

  it('applies beat ops (nudge) and section labels', () => {
    const beats = applyBeatCorrections(fixtures.beats(), [
      { op: 'nudge_beat', beat_id: 'b0005', delta_s: -0.012 },
    ])
    expect(beats.value.beats.find((b) => b.id === 'b0005')?.t).toBeCloseTo(3.488)
    const sections = applySectionCorrections(fixture<Sections>('sections'), fixtures.corrections())
    expect(sections.value.segments.find((s) => s.id === 's0002')?.label).toBe('outro')
  })

  it('mark_correct and report_wrong change nothing that is shown', () => {
    const notes = fixtures.notes()
    const { value } = applyNoteCorrections(notes, [
      { op: 'mark_correct', entity_id: 'n000001' },
      { op: 'report_wrong', entity_id: 'n000002' },
    ])
    expect(value.notes).toStrictEqual(notes.notes)
  })
})
