import { describe, expect, it } from 'vitest'
import { DRUM_LANES, gridWindow, mixedLanes, PLAYHEAD_AT, unsure } from '../src/drum-grid.tsx'

describe('drum grid', () => {
  it('stacks the lanes as a drum staff does: cymbals on top, kick at the bottom', () => {
    expect(DRUM_LANES[0]).toBe('cymbals')
    expect(DRUM_LANES.at(-1)).toBe('kick')
  })

  it('keeps the playhead a quarter of the way in, or holds still for a page', () => {
    expect(gridWindow(10, 4)).toEqual({ start: 10 - 4 * PLAYHEAD_AT, end: 13 })
    expect(gridWindow(10.3, 4, (t) => Math.floor(t / 4) * 4)).toEqual({ start: 8, end: 12 })
  })

  it('letters a lane only when it holds more than one kit piece', () => {
    const mixed = mixedLanes([
      { lane: 'hihat', gmNote: 42 },
      { lane: 'hihat', gmNote: 46 },
      { lane: 'cymbals', gmNote: 49 },
      { lane: 'cymbals', gmNote: 57 },
      { lane: 'toms', gmNote: 47 },
    ])
    expect([...mixed]).toEqual(['hihat'])
  })

  it('draws kit-piece guesses and medium or low hits as unsure', () => {
    expect(unsure({ band: 'high', approximate: false })).toBe(false)
    expect(unsure({ band: 'high', approximate: true })).toBe(true)
    expect(unsure({ band: 'medium', approximate: false })).toBe(true)
  })
})
