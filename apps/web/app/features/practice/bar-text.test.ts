import { describe, expect, it } from 'vitest'
import { barAndBeat } from './bar-text'

describe('barAndBeat', () => {
  it('counts bars from 1 with the beat after a point', () => {
    expect(barAndBeat({ bar: 0, beat: 1 })).toBe('1.1')
    expect(barAndBeat({ bar: 25, beat: 3 })).toBe('26.3')
  })

  it('shows the lead-in before the first bar as a dash, not as bar 0', () => {
    expect(barAndBeat({ bar: -1, beat: 4 })).toBe('–')
  })
})
