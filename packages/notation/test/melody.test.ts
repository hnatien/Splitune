import { describe, expect, it } from 'vitest'
import {
  degreeName,
  followWindow,
  type MelodyRollNote,
  MIN_SPAN,
  phraseIndexAt,
  wholeWindow,
} from '../src/melody.ts'

const note = (pitch: number, t0: number, t1: number, band: MelodyRollNote['band'] = 'high') => ({
  pitch,
  t0,
  t1,
  band,
})

describe('pitch windows', () => {
  const notes = [note(60, 0, 1), note(64, 1, 2), note(84, 2, 2.5, 'low'), note(72, 10, 11)]

  it('follows what is sung in view, two semitones over and under, an octave at least', () => {
    expect(followWindow(notes, 0, 3, 1, { low: 0, high: 0 })).toEqual({ low: 56, high: 68 })
    const wide = followWindow(notes, 0, 12, 1, { low: 0, high: 0 })
    expect(wide).toEqual({ low: 58, high: 74 })
    expect(wide.high - wide.low).toBeGreaterThanOrEqual(MIN_SPAN)
  })

  it('ignores low-confidence notes and keeps the last window over a rest', () => {
    const last = { low: 50, high: 62 }
    expect(followWindow(notes, 3, 9, 1, last)).toBe(last)
  })

  it('counts a long note that started before the view', () => {
    const held = [note(55, 0, 8)]
    expect(followWindow(held, 5, 6, 8, { low: 0, high: 0 })).toEqual({ low: 49, high: 61 })
  })

  it('maps the whole song without low-confidence notes', () => {
    expect(wholeWindow(notes)).toEqual({ low: 58, high: 74 })
  })
})

describe('phraseIndexAt', () => {
  const phrases = [
    { t0: 1, t1: 4 },
    { t0: 6, t1: 9 },
  ]
  it('finds the phrase a time belongs to, up to the next one', () => {
    expect(phraseIndexAt(phrases, 0.5)).toBe(-1)
    expect(phraseIndexAt(phrases, 1)).toBe(0)
    expect(phraseIndexAt(phrases, 5)).toBe(0)
    expect(phraseIndexAt(phrases, 6)).toBe(1)
    expect(phraseIndexAt(phrases, 20)).toBe(1)
  })
})

describe('degreeName', () => {
  it('names degrees against the tonic', () => {
    // A♭ major: E♭ is 5, C is 3, B is ♭3 (as a minor third over A♭).
    expect([63, 72, 71, 56].map((p) => degreeName(p, 8))).toEqual(['5', '3', '♭3', '1'])
  })
})
