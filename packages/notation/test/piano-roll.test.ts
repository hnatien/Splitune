import { describe, expect, it } from 'vitest'
import { keyboardKeys } from '../src/keyboard-diagram.tsx'
import { type RollNote, rollRange, rollWindow, soundingNotes } from '../src/piano-roll.tsx'

describe('keyboard geometry', () => {
  it('lays an octave out as seven white keys with the black keys between them', () => {
    const { keys, width } = keyboardKeys(60, 72)
    expect(width).toBe(80)
    expect(keys.filter((k) => !k.black).map((k) => k.x)).toEqual([0, 10, 20, 30, 40, 50, 60, 70])
    // C♯ straddles C and D; F♯ straddles F and G.
    expect(keys.find((k) => k.midi === 61)).toEqual({ midi: 61, x: 7, width: 6, black: true })
    expect(keys.find((k) => k.midi === 66)?.x).toBe(37)
  })
})

describe('roll range', () => {
  it('shows whole octaves from C, at least C3 to C6', () => {
    expect(rollRange([])).toEqual({ from: 48, to: 84 })
    expect(rollRange([60, 64, 67])).toEqual({ from: 48, to: 84 })
    expect(rollRange([33, 91])).toEqual({ from: 24, to: 96 })
  })

  it('stays on the piano', () => {
    expect(rollRange([21, 108])).toEqual({ from: 21, to: 108 })
  })
})

describe('roll window', () => {
  it('follows the clock, or holds still for a page with reduced motion', () => {
    expect(rollWindow(10.3, 4)).toEqual({ start: 10.3, end: 14.3 })
    const page = (t: number) => Math.floor(t / 2) * 2
    expect(rollWindow(10.3, 4, page)).toEqual({ start: 10, end: 14 })
    expect(rollWindow(11.9, 4, page)).toEqual({ start: 10, end: 14 })
  })
})

describe('sounding notes', () => {
  const note = (id: string, t0: number, t1: number): RollNote => ({
    id,
    pitch: 60,
    hand: 'right',
    t0,
    t1,
    band: 'high',
  })
  // By onset; the longest note (a) lasts 4 s.
  const notes = [note('a', 0, 4), note('b', 1, 1.5), note('c', 1, 2), note('d', 3, 3.2)]

  it('finds the notes held at a time, a long one started bars before included', () => {
    expect(soundingNotes(notes, 1.2, 4).map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(soundingNotes(notes, 3.1, 4).map((n) => n.id)).toEqual(['a', 'd'])
  })

  it('counts a note from its onset up to, not including, its end', () => {
    expect(soundingNotes(notes, 1.5, 4).map((n) => n.id)).toEqual(['a', 'c'])
    expect(soundingNotes(notes, 4, 4)).toEqual([])
    expect(soundingNotes(notes, -1, 4)).toEqual([])
  })
})
