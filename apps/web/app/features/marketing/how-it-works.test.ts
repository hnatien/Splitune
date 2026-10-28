import { describe, expect, it } from 'vitest'
import { riseProgress, scrollPosition } from './how-it-works'
import { ramp } from './how-scenes'

// How it works (27 §3.2): the scroll is the scenes' clock, so these map positions to frames.
describe('scrollPosition', () => {
  // Four 1000 px steps in a 800 px viewport; the middle line is at 400.
  const steps = (firstTop: number) =>
    [0, 1, 2, 3].map((i) => ({ top: firstTop + i * 1000, height: 1000 }))

  it('holds the first step at its first frame before it reaches the middle', () => {
    expect(scrollPosition(steps(600), 800)).toEqual({ step: 0, t: 0 })
  })

  it('plays a step from its top at the middle to its bottom at the viewport bottom', () => {
    expect(scrollPosition(steps(400), 800)).toEqual({ step: 0, t: 0 })
    expect(scrollPosition(steps(100), 800)).toEqual({ step: 0, t: 0.5 })
    expect(scrollPosition(steps(-200), 800)).toEqual({ step: 0, t: 1 })
  })

  it('holds the last frame until the next step reaches the middle, then switches', () => {
    expect(scrollPosition(steps(-500), 800)).toEqual({ step: 0, t: 1 })
    expect(scrollPosition(steps(-600), 800)).toEqual({ step: 1, t: 0 })
  })

  it('finishes the last step when its bottom reaches the viewport bottom', () => {
    expect(scrollPosition(steps(-3200), 800)).toEqual({ step: 3, t: 1 })
  })

  it('shows a step shorter than half the viewport finished once it is current', () => {
    expect(scrollPosition([{ top: 100, height: 300 }], 800)).toEqual({ step: 0, t: 1 })
    expect(scrollPosition([{ top: 500, height: 300 }], 800)).toEqual({ step: 0, t: 0 })
  })

  it('copes with no steps', () => {
    expect(scrollPosition([], 800)).toEqual({ step: 0, t: 0 })
  })
})

describe('riseProgress', () => {
  it('plays a picture as its top rises from 90 % to 40 % of the viewport', () => {
    expect(riseProgress(1000, 1000)).toBe(0)
    expect(riseProgress(900, 1000)).toBe(0)
    expect(riseProgress(650, 1000)).toBe(0.5)
    expect(riseProgress(400, 1000)).toBe(1)
    expect(riseProgress(-200, 1000)).toBe(1)
  })
})

describe('ramp', () => {
  it('is 0 before its range, 1 after it and eases out inside it', () => {
    expect(ramp(0.1, 0.2, 0.6)).toBe(0)
    expect(ramp(0.7, 0.2, 0.6)).toBe(1)
    expect(ramp(0.4, 0.2, 0.6)).toBeCloseTo(0.875)
    expect(ramp(0.4, 0.2, 0.6, false)).toBeCloseTo(0.5)
  })
})
