import { describe, expect, it } from 'vitest'
import { PeakLimiter } from './limiter.ts'

const SR = 48000
const sine = (frames: number, amplitude: number, from = 0) =>
  Float32Array.from(
    { length: frames },
    (_, i) => amplitude * Math.sin((2 * Math.PI * 440 * (from + i)) / SR),
  )
const peakOf = (signal: Float32Array) => signal.reduce((top, x) => Math.max(top, Math.abs(x)), 0)

describe('PeakLimiter', () => {
  it('leaves a signal under the ceiling untouched', () => {
    const limiter = new PeakLimiter(SR)
    const left = sine(128, 0.9)
    const right = sine(128, 0.5)
    const before = [Float32Array.from(left), Float32Array.from(right)]
    limiter.process(left, right)
    expect(left).toEqual(before[0])
    expect(right).toEqual(before[1])
    expect(limiter.takeReductionDb()).toBe(0)
  })

  it('never lets a sample pass 0 dBFS, on either channel, block after block', () => {
    const limiter = new PeakLimiter(SR)
    for (let block = 0; block < 400; block++) {
      const left = sine(128, 2.5, block * 128)
      const right = sine(128, 0.3, block * 128)
      limiter.process(left, right)
      expect(peakOf(left)).toBeLessThanOrEqual(1)
      expect(peakOf(right)).toBeLessThanOrEqual(1)
    }
    expect(limiter.takeReductionDb()).toBeLessThan(-7.9)
  })

  it('links the channels, so the stereo image stays', () => {
    const limiter = new PeakLimiter(SR)
    const left = new Float32Array([2, 2, 2])
    const right = new Float32Array([1, 1, 1])
    limiter.process(left, right)
    expect(Array.from(left).map((x, i) => x / (right[i] ?? 1))).toEqual([2, 2, 2])
  })

  it('recovers to unity after a peak, within the release', () => {
    const limiter = new PeakLimiter(SR)
    limiter.process(new Float32Array([4]), new Float32Array([4]))
    const quiet = new Float32Array(SR).fill(0.5)
    limiter.process(quiet, quiet)
    expect(quiet[0]).toBeCloseTo(0.125, 3)
    expect(quiet[SR - 1]).toBeGreaterThan(0.4999)
  })

  it('limits a mono block once', () => {
    const limiter = new PeakLimiter(SR)
    const mono = new Float32Array([3, 0.5])
    limiter.process(mono, mono)
    expect(mono[0]).toBeCloseTo(1, 6)
  })
})
