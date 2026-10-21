import { describe, expect, it } from 'vitest'
import { StatsAccumulator } from './audio-stats'
import { isBlocking, MAX_BYTES, preflight } from './preflight'

const RATE = 8_000

function stats(signal: (i: number) => number, seconds: number) {
  const accumulator = new StatsAccumulator(RATE)
  const samples = new Float32Array(RATE * seconds).map((_, i) => signal(i))
  for (let i = 0; i < samples.length; i += 1000) accumulator.add(samples.subarray(i, i + 1000))
  return accumulator.finish(seconds)
}

const tone = (amplitude: number) => (i: number) =>
  amplitude * Math.sin((2 * Math.PI * 220 * i) / RATE)

describe('pre-flight', () => {
  it('passes a normal recording', () => {
    expect(preflight(1_000_000, stats(tone(0.5), 4))).toEqual([])
  })

  it('warns about quiet, clipped and mostly silent audio without blocking', () => {
    expect(preflight(1, stats(tone(0.01), 4)).map((i) => i.kind)).toEqual(['quiet'])
    expect(
      preflight(
        1,
        stats((i) => (i % 2 ? 1 : -1), 4),
      ).map((i) => i.kind),
    ).toEqual(['clipping'])
    const silentThenTone = (i: number) => (i < RATE * 3 ? 0 : tone(0.5)(i))
    const issues = preflight(1, stats(silentThenTone, 4))
    expect(issues.map((i) => i.kind)).toEqual(['mostly_silent'])
    expect(issues.some(isBlocking)).toBe(false)
  })

  it('blocks files over 20 minutes or 500 MB', () => {
    const long = { ...stats(tone(0.5), 1), durationS: 20 * 60 + 1 }
    expect(
      preflight(MAX_BYTES + 1, long)
        .filter(isBlocking)
        .map((i) => i.kind),
    ).toEqual(['too_large', 'too_long'])
  })

  it('bins peaks to at most 400 values in 0–1', () => {
    const { peaks } = stats(tone(0.5), 120)
    expect(peaks.length).toBeLessThanOrEqual(400)
    expect(Math.max(...peaks)).toBeCloseTo(0.5, 2)
  })
})
