import { describe, expect, it } from 'vitest'
import {
  type FretNote,
  fitReadPx,
  fretKeys,
  fretUnit,
  fretWindowAt,
  groupAfter,
  noteGroups,
  REFRAME_LEAD,
  rowAt,
  spaceAt,
  stringRows,
  wireAt,
} from '../src/fretboard.ts'
import { rollStretches } from '../src/guitar-roll.tsx'

const note = (id: string, t0: number, string: number, fret: number): FretNote => ({
  id,
  string,
  fret,
  t0,
  t1: t0 + 0.4,
  band: 'high',
})

describe('fret spacing', () => {
  it('narrows up the neck, less than a real neck does', () => {
    const width = (fret: number) => fretUnit(fret) - fretUnit(fret - 1)
    expect(fretUnit(0)).toBe(0)
    expect(fretUnit(1)).toBeCloseTo(1)
    expect(width(12)).toBeLessThan(width(1))
    // A real twelfth fret is half the first; compressed it keeps over three quarters.
    expect(width(12) / width(1)).toBeGreaterThan(0.75)
  })

  it('places wires and spaces across the window', () => {
    const window = { lo: 5, hi: 9 }
    expect(wireAt(window, 4)).toBe(0)
    expect(wireAt(window, 9)).toBe(1)
    expect(spaceAt(window, 5)).toBeGreaterThan(0)
    expect(spaceAt(window, 5)).toBeLessThan(wireAt(window, 5))
    expect(spaceAt(window, 9)).toBeLessThan(1)
  })
})

describe('neck window', () => {
  // Bars of 2 s: open position; a bar at the 7th–9th frets that ends needing frets 2 and 14
  // (more than nine, so it splits); a bar that fits where the neck already is.
  const notes = [
    note('a', 0.1, 3, 2),
    note('b', 0.6, 2, 3),
    note('c', 1.2, 1, 0),
    note('d', 2.1, 3, 7),
    note('e', 2.5, 2, 9),
    note('f', 3.1, 4, 2),
    note('g', 3.4, 1, 14),
    note('h', 4.2, 3, 4),
    note('i', 5.5, 2, 6),
  ]
  const keys = fretKeys(notes, [0, 2, 4, 6])

  it('moves only for notes that leave the window, from the first of them', () => {
    expect(keys).toEqual([
      { t: 0, lo: 1, hi: 5 },
      { t: 2.1, lo: 7, hi: 11 },
      { t: 3.1, lo: 1, hi: 9 },
    ])
  })

  it('keeps a stretch wider than nine frets to its lowest notes', () => {
    expect(fretKeys([note('a', 0, 1, 5), note('b', 0.2, 1, 17)], [0])).toEqual([
      { t: 0, lo: 5, hi: 13 },
    ])
  })

  it('moves a little before the notes that need it', () => {
    expect(fretWindowAt(keys, 1.4)).toEqual({ lo: 1, hi: 5 })
    expect(fretWindowAt(keys, 2.1 - REFRAME_LEAD)).toEqual({ lo: 7, hi: 11 })
    expect(fretWindowAt(keys, 9)).toEqual({ lo: 1, hi: 9 })
    expect(fretWindowAt([], 1)).toEqual({ lo: 1, hi: 5 })
  })

  it("is the loop start's in the loop's last moments, so the wrap doesn't move it", () => {
    const loop = { t0: 0, t1: 3 }
    expect(fretWindowAt(keys, 2.4, loop)).toEqual({ lo: 7, hi: 11 })
    expect(fretWindowAt(keys, 2.6, loop)).toEqual({ lo: 1, hi: 5 })
    expect(fretWindowAt(keys, 3.2, loop)).toEqual({ lo: 1, hi: 9 })
  })
})

describe('strums', () => {
  const notes = [
    note('a', 1, 6, 0),
    note('b', 1.02, 5, 2),
    note('c', 1.03, 4, 2),
    note('d', 1.5, 3, 1),
  ]
  const groups = noteGroups(notes)

  it('groups onsets within a strum as one shape', () => {
    expect(groups.map((g) => g.notes.map((n) => n.id))).toEqual([['a', 'b', 'c'], ['d']])
    expect(groups[0]?.t0).toBe(1)
  })

  it('finds the next shape, wrapping to the loop start at its end', () => {
    expect(groupAfter(groups, 0.5)?.t0).toBe(1)
    expect(groupAfter(groups, 1)?.t0).toBe(1.5)
    expect(groupAfter(groups, 2)).toBeUndefined()
    expect(groupAfter(groups, 1.2, { t0: 0.9, t1: 1.4 })?.t0).toBe(1)
    expect(groupAfter(groups, 0.95, { t0: 0.9, t1: 1.4 })?.t0).toBe(1)
  })
})

describe('string rows', () => {
  it('fits the strings between the chord names and the numbers, string 1 on top', () => {
    const rows = stringRows(470, 6, 36)
    expect(rows.lane).toBeGreaterThan(36 * 1.6)
    expect(rows.lane).toBeLessThanOrEqual(36 * 1.8)
    expect(rowAt(rows, 1)).toBeLessThan(rowAt(rows, 6))
    expect(rowAt(rows, 6) + rows.lane / 2 + rows.foot).toBeLessThanOrEqual(470)
    expect(rowAt(rows, 1) - rows.lane / 2).toBeGreaterThanOrEqual(rows.head)
  })

  it('fits the digits to a short paper, keeping lanes 1.3 times their height', () => {
    for (const [height, strings] of [
      [200, 6],
      [240, 6],
      [200, 4],
      [260, 7],
    ] as const) {
      const px = fitReadPx(height, strings)
      expect(stringRows(height, strings, px).lane).toBeGreaterThanOrEqual(px * 1.3 - 1e-9)
    }
    expect(fitReadPx(470, 6)).toBeGreaterThan(36)
  })

  it('shrinks the lanes on a short paper', () => {
    const rows = stringRows(200, 6, 24)
    expect(rows.lane).toBeLessThan(24 * 1.8)
    expect(rows.lane).toBeGreaterThan(20)
  })
})

describe('lane stretches', () => {
  const out = Array.from({ length: 4 }, () => ({ a: 0, b: 0, off: 0, clip: 0 }))

  it('shows the timeline as it is without a loop, or outside it', () => {
    expect(rollStretches(10, 12, null, out)).toBe(1)
    expect(out[0]).toEqual({ a: 10, b: 12, off: 0, clip: Number.POSITIVE_INFINITY })
    expect(rollStretches(10, 12, { t0: 2, t1: 6 }, out)).toBe(1)
  })

  it("runs on past a loop's end into its next pass, so the wrap never blanks", () => {
    // A 2 s loop from 4 to 6 s, 3 s in view from 5.5 s: the last half second, a whole next pass,
    // then the start of the one after, each placed on the view's clock by its offset.
    expect(rollStretches(5.5, 8.5, { t0: 4, t1: 6 }, out)).toBe(3)
    expect(out.slice(0, 3)).toEqual([
      { a: 5.5, b: 6, off: 0, clip: 6 },
      { a: 4, b: 6, off: 2, clip: 6 },
      { a: 4, b: 4.5, off: 4, clip: 6 },
    ])
  })
})
