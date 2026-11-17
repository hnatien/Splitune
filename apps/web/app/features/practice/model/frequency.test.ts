import { describe, expect, it } from 'vitest'
import { oneIn, wrongOneIn } from './frequency'

describe('frequency wording', () => {
  it('rounds a probability to the nearest of 1 in 2 / 3 / 4 / 5 / 10 / 20', () => {
    expect(oneIn(1)).toBe(2)
    expect(oneIn(0.5)).toBe(2)
    expect(oneIn(1 / 3)).toBe(3)
    expect(oneIn(0.25)).toBe(4)
    expect(oneIn(0.2)).toBe(5)
    expect(oneIn(0.1)).toBe(10)
    expect(oneIn(0.05)).toBe(20)
  })

  // The boundaries sit where two neighbours are equally far as ratios (their geometric mean).
  it.each([
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 10],
    [10, 20],
  ])('switches between 1 in %i and 1 in %i at their boundary', (lower, upper) => {
    const boundary = 1 / Math.sqrt(lower * upper)
    expect(oneIn(boundary + 0.004)).toBe(lower)
    expect(oneIn(boundary - 0.004)).toBe(upper)
  })

  it('never says rarer than 1 in 20, or more often than 1 in 2', () => {
    expect(oneIn(0.001)).toBe(20)
    expect(oneIn(0)).toBe(20)
    expect(oneIn(-1)).toBe(20)
    expect(oneIn(3)).toBe(2)
  })

  it('states how often a guess of a confidence is wrong', () => {
    expect(wrongOneIn(0.67)).toBe(3)
    expect(wrongOneIn(0.5)).toBe(2)
    expect(wrongOneIn(0.9)).toBe(10)
    expect(wrongOneIn(1)).toBe(20)
  })

  it('speaks for a band from the mean of its marks, and for nothing when it is empty', () => {
    expect(wrongOneIn([0.6, 0.7, 0.7])).toBe(3)
    expect(wrongOneIn([0.2, 0.8])).toBe(2)
    expect(wrongOneIn([])).toBeNull()
  })
})
