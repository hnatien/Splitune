import beats from '@splitune/contracts/fixtures/beats.json'
import type { Beats } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { practiceGrid } from './grid'
import { barRange, clipBeats, nudge, restSeconds, tapBar } from './loops'

const grid = practiceGrid(beats as Beats)

describe('bar-tap loops', () => {
  it('arms on the first tap and spans both bars on the second, in either order', () => {
    const armed = tapBar({ kind: 'none' }, 4, grid)
    expect(armed).toEqual({ kind: 'armed', bar: 4 })
    const active = tapBar(armed, 2, grid)
    expect(active).toEqual({
      kind: 'active',
      range: {
        startBar: 2,
        endBar: 4,
        start: expect.closeTo(5.3, 6),
        end: expect.closeTo(12.5, 6),
      },
    })
    // A new tap starts a new selection.
    expect(tapBar(active, 6, grid)).toEqual({ kind: 'armed', bar: 6 })
  })

  it('loops one bar when the same bar is tapped twice', () => {
    const range = barRange(grid, 3, 3)
    expect(range).toMatchObject({ startBar: 3, endBar: 3 })
    expect(range.end - range.start).toBeCloseTo(2.4)
  })

  it('nudges an edge by a sixteenth and never empties the loop', () => {
    const range = barRange(grid, 2, 2)
    expect(nudge(grid, range, 'start', 1).start - range.start).toBeCloseTo(0.15)
    expect(nudge(grid, range, 'end', -1).end - range.end).toBeCloseTo(-0.15)
    let tiny = range
    for (let i = 0; i < 40; i++) tiny = nudge(grid, tiny, 'end', -1)
    expect(tiny.end - tiny.start).toBeGreaterThanOrEqual(0.15 - 1e-9)
  })

  it('describes the clip in contract bars and beats', () => {
    expect(clipBeats(grid, barRange(grid, 2, 3))).toEqual({
      start_bar: 2,
      start_beat: 1,
      end_bar: 3,
      end_beat: 4,
    })
  })

  it('rests one beat or one bar of the loop’s tempo', () => {
    const range = barRange(grid, 2, 3)
    expect(restSeconds(grid, range, 'none')).toBe(0)
    expect(restSeconds(grid, range, 'beat')).toBeCloseTo(0.6)
    expect(restSeconds(grid, range, 'bar')).toBeCloseTo(2.4)
  })
})
