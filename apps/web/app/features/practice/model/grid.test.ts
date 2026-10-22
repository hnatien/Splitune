import beats from '@splitune/contracts/fixtures/beats.json'
import type { Beats } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { barAt, practiceGrid } from './grid'

// Fixture: 32 beats 0.6 s apart from 0.5 s, 4/4, bars 0–7.
const grid = practiceGrid(beats as Beats)

describe('practice grid', () => {
  it('knows the detected bars and their times', () => {
    expect(grid.bars).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(grid.barStart(0)).toBeCloseTo(0.5)
    expect(grid.barStart(3)).toBeCloseTo(7.7)
    expect(grid.barEnd(3)).toBeCloseTo(10.1)
    expect(grid.beatsOf(1)).toEqual([2.9, 3.5, 4.1, 4.7].map((t) => expect.closeTo(t, 6)))
  })

  it('extrapolates bars past the last detected beat', () => {
    expect(grid.barStart(8)).toBeCloseTo(19.7)
    expect(grid.barEnd(8)).toBeCloseTo(22.1)
  })

  it('finds bar and beat at a time', () => {
    expect(grid.positionAt(0.5)).toEqual({ bar: 0, beat: 1 })
    expect(grid.positionAt(8.4)).toEqual({ bar: 3, beat: 2 })
    expect(barAt(grid, 0)).toBe(0)
    expect(barAt(grid, 100)).toBe(7)
  })
})
