import { describe, expect, it } from 'vitest'
import { buildPianoScore, PPQ, splitHands } from '../src/index.ts'
import { makeBeats, makeNotes } from './helpers.ts'

const at = (beat: number) => beat * PPQ

describe('splitHands', () => {
  it('splits a bass note and a right-hand chord at middle C', () => {
    const hands = splitHands([
      { id: 'bass', pitch: 36, onTick: 0 },
      { id: 'c', pitch: 60, onTick: 0 },
      { id: 'e', pitch: 64, onTick: 0 },
      { id: 'g', pitch: 67, onTick: 0 },
    ])
    expect(Object.fromEntries(hands)).toEqual({ bass: 'left', c: 'right', e: 'right', g: 'right' })
  })

  it('keeps a melody in the right hand when it dips below middle C over a low left hand', () => {
    const notes = [
      { id: 'l1', pitch: 36, onTick: at(0) },
      { id: 'm1', pitch: 64, onTick: at(0) },
      { id: 'm2', pitch: 62, onTick: at(1) },
      { id: 'l2', pitch: 43, onTick: at(2) },
      { id: 'm3', pitch: 57, onTick: at(2) },
      { id: 'm4', pitch: 59, onTick: at(3) },
    ]
    const hands = splitHands(notes)
    expect(['m1', 'm2', 'm3', 'm4'].map((id) => hands.get(id))).toEqual([
      'right',
      'right',
      'right',
      'right',
    ])
    expect([hands.get('l1'), hands.get('l2')]).toEqual(['left', 'left'])
  })

  it('moves the split with a left hand that climbs above middle C', () => {
    const notes = [
      { id: 'l', pitch: 62, onTick: 0 },
      { id: 'l5', pitch: 69, onTick: 0 },
      { id: 'r1', pitch: 76, onTick: 0 },
      { id: 'r2', pitch: 84, onTick: 0 },
    ]
    const hands = splitHands(notes)
    expect(Object.fromEntries(hands)).toEqual({ l: 'left', l5: 'left', r1: 'right', r2: 'right' })
  })

  it('never gives one hand more than an octave and a half when the other can take notes', () => {
    const notes = [40, 47, 52, 64, 67, 72, 76].map((pitch, i) => ({
      id: `n${i}`,
      pitch,
      onTick: 0,
    }))
    const hands = splitHands(notes)
    for (const hand of ['left', 'right'] as const) {
      const pitches = notes.filter((n) => hands.get(n.id) === hand).map((n) => n.pitch)
      expect(Math.max(...pitches) - Math.min(...pitches)).toBeLessThanOrEqual(18)
    }
  })

  it('returns nothing for no notes and is deterministic', () => {
    expect(splitHands([]).size).toBe(0)
    const notes = [48, 55, 60, 65].map((pitch, i) => ({ id: `n${i}`, pitch, onTick: at(i) }))
    expect([...splitHands(notes)]).toEqual([...splitHands(notes)])
  })
})

describe('buildPianoScore', () => {
  const beats = makeBeats({ bpm: 120, bars: 2, start: 0.5 })

  it('quantizes onto the beat grid and assigns hands', () => {
    const notes = makeNotes(
      [
        { id: 'l', onset_s: 0.51, offset_s: 1.48, pitch_midi: 36 },
        { id: 'r', onset_s: 0.52, offset_s: 0.98, pitch_midi: 67 },
        { id: 'r2', onset_s: 1.03, offset_s: 1.49, pitch_midi: 69, confidence: 0.2 },
      ],
      'piano',
    )
    const score = buildPianoScore(notes, beats)
    expect(score.notes.map((n) => [n.id, n.hand, n.onTick, n.offTick])).toEqual([
      ['l', 'left', 0, at(2)],
      ['r', 'right', 0, at(1)],
      ['r2', 'right', at(1), at(2)],
    ])
    expect(score.notes[0]).toMatchObject({ t0: 0.5, t1: 1.5, band: 'high' })
    expect(score.notes[2]?.band).toBe('low')
  })

  it('ends a note where the next note on the same key starts', () => {
    const notes = makeNotes(
      [
        { id: 'a', onset_s: 0.5, offset_s: 1.6, pitch_midi: 60 },
        { id: 'b', onset_s: 1.0, offset_s: 1.4, pitch_midi: 60 },
      ],
      'piano',
    )
    const [a, b] = buildPianoScore(notes, beats).notes
    expect(a?.offTick).toBe(at(1))
    expect(b?.onTick).toBe(at(1))
  })

  it('applies the learner corrections before quantizing', () => {
    const notes = makeNotes([{ id: 'a', onset_s: 0.5, pitch_midi: 60 }], 'piano')
    const score = buildPianoScore(notes, beats, {
      notes: [
        { op: 'set_note', note_id: 'a', patch: { pitch_midi: 62 } },
        { op: 'delete_note', note_id: 'missing' },
      ],
    })
    expect(score.notes[0]?.pitch).toBe(62)
    expect(score.skippedCorrections.notes).toEqual([1])
  })

  it('rejects other instruments', () => {
    expect(() => buildPianoScore(makeNotes([{ pitch_midi: 60 }]), beats)).toThrow(RangeError)
  })
})
