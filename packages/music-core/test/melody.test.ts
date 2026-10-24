import { describe, expect, it } from 'vitest'
import { buildMelody, sameMelody } from '../src/index.ts'
import { makeBeats, makeNotes } from './helpers.ts'

// 120 BPM from 0.5 s: a beat is 0.5 s, a bar 2 s, bar n starts at 0.5 + 2n.
const beats = makeBeats({ bpm: 120, bars: 16 })

// A sung line: [onset, length, pitch] per note, legato unless a gap is given.
function line(start: number, pitches: number[], step = 0.5, confidence = 0.9) {
  return pitches.map((pitch, i) => ({
    onset_s: start + i * step,
    offset_s: start + i * step + step * 0.9,
    pitch_midi: pitch,
    confidence,
  }))
}

describe('buildMelody', () => {
  it('splits phrases at rests of at least 0.6 s and finds their bars', () => {
    const notes = makeNotes(
      [...line(0.5, [60, 62, 64, 65]), ...line(3.5, [67, 65, 64, 62]), ...line(5.6, [60, 60])],
      'vocals',
    )
    const melody = buildMelody(notes, beats)
    // 2.45 → 3.5 is a 1.05 s rest; 5.45 → 5.6 only 0.15 s, so the last two notes join phrase 2,
    // which ends at 6.55 s, just into bar 3 (6.5 s).
    expect(melody.phrases.map((p) => [p.from, p.to])).toEqual([
      [0, 3],
      [4, 9],
    ])
    expect(melody.phrases.map((p) => [p.startBar, p.endBar])).toEqual([
      [0, 0],
      [1, 3],
    ])
  })

  it('keeps notes on their sung timing, by onset', () => {
    const notes = makeNotes(
      [
        { onset_s: 1.03, offset_s: 1.4, pitch_midi: 64 },
        { onset_s: 0.52, offset_s: 0.98, pitch_midi: 62 },
      ],
      'vocals',
    )
    const melody = buildMelody(notes, beats)
    expect(melody.notes.map((n) => [n.pitch, n.t0, n.t1])).toEqual([
      [62, 0.52, 0.98],
      [64, 1.03, 1.4],
    ])
  })

  it('splits a run longer than four bars at its largest gap', () => {
    // 20 notes a beat apart with no rest (10 s, five bars), the widest gap after note 12.
    const notes = line(
      0.5,
      Array.from({ length: 20 }, (_, i) => 60 + (i % 5)),
    )
    for (const note of notes.slice(12)) {
      note.onset_s += 0.3
      note.offset_s += 0.3
    }
    const melody = buildMelody(makeNotes(notes, 'vocals'), beats)
    expect(melody.phrases.map((p) => [p.from, p.to])).toEqual([
      [0, 11],
      [12, 19],
    ])
  })

  it('pitches from the first note that is not low confidence', () => {
    const notes = makeNotes(
      [
        { onset_s: 0.5, offset_s: 0.9, pitch_midi: 55, confidence: 0.2 },
        { onset_s: 1, offset_s: 1.4, pitch_midi: 60 },
      ],
      'vocals',
    )
    const [phrase] = buildMelody(notes, beats).phrases
    expect(phrase?.first).toBe(1)
  })

  it('gives repeated melodies the same letter, even across an octave slip', () => {
    const a = [60, 62, 64, 65, 67]
    const notes = makeNotes(
      [
        ...line(0.5, a),
        ...line(4.5, [67, 69, 71, 72, 74]),
        // A again, its third note an octave off.
        ...line(8.5, [60, 62, 76, 65, 67]),
        // A with one changed note is still A.
        ...line(12.5, [60, 62, 64, 65, 69]),
      ],
      'vocals',
    )
    const melody = buildMelody(notes, beats)
    expect(melody.phrases.map((p) => `${p.letter}${p.repeat ? '′' : ''}`)).toEqual([
      'A',
      'B',
      'A′',
      'A′',
    ])
  })

  it('measures the range without low-confidence notes', () => {
    const sure = line(0.5, [57, 60, 62, 64, 65, 67, 69, 72])
    const unsure = line(5, [36, 96], 0.5, 0.1)
    const melody = buildMelody(makeNotes([...sure, ...unsure], 'vocals'), beats)
    expect(melody.range).toEqual({ low: 57, high: 72 })
    expect(buildMelody(makeNotes(unsure, 'vocals'), beats).range).toBeNull()
  })

  it('applies note corrections first', () => {
    const notes = makeNotes(line(0.5, [60, 62, 64]), 'vocals')
    const melody = buildMelody(notes, beats, {
      notes: [{ op: 'delete_note', note_id: 'n000001' }],
    })
    expect(melody.notes.map((n) => n.pitch)).toEqual([60, 64])
  })

  it('refuses other instruments', () => {
    expect(() => buildMelody(makeNotes([], 'guitar'), beats)).toThrow(RangeError)
  })
})

describe('sameMelody', () => {
  it('needs four notes, lengths within one, and at most one pitch class apart', () => {
    expect(sameMelody([0, 2, 4], [0, 2, 4])).toBe(false)
    expect(sameMelody([0, 2, 4, 5], [0, 2, 4, 5, 7])).toBe(true)
    expect(sameMelody([0, 2, 4, 5], [0, 2, 4, 5, 7, 9])).toBe(false)
    expect(sameMelody([0, 2, 4, 5], [0, 3, 4, 6])).toBe(false)
  })
})
