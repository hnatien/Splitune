import { describe, expect, it } from 'vitest'
import { PEAK_BLOCK, timelineFrames, toStemPcm } from './pcm.ts'
import { resample, resampledLength } from './resample.ts'

describe('toStemPcm', () => {
  it('interleaves, converts to Int16 and clamps', () => {
    const { pcm } = toStemPcm(
      [new Float32Array([0, 1, -1, 2]), new Float32Array([0.5, -0.5, Number.NaN, -2])],
      4,
    )
    expect([...pcm]).toEqual([0, 16384, 32767, -16384, -32768, 0, 32767, -32768])
  })

  it('duplicates mono and pads or trims to the timeline length', () => {
    expect([...toStemPcm([new Float32Array([0.5])], 2).pcm]).toEqual([16384, 16384, 0, 0])
    expect(toStemPcm([new Float32Array(10), new Float32Array(10)], 4).pcm.length).toBe(8)
  })

  it('computes min/max peaks of the mono mix per block', () => {
    const left = new Float32Array(PEAK_BLOCK + 1).fill(0.5)
    left[3] = -1
    const { peaks } = toStemPcm([left, new Float32Array(PEAK_BLOCK + 1)], PEAK_BLOCK + 1)
    expect([...peaks]).toEqual([-0.5, 0.25, 0, 0.25])
  })

  it('rounds durations to frames', () => {
    expect(timelineFrames(10.00001, 48000)).toBe(480000)
  })
})

describe('resample', () => {
  const sine = (rate: number, frequency: number, frames: number) =>
    Float32Array.from({ length: frames }, (_, i) => Math.sin((2 * Math.PI * frequency * i) / rate))

  it('keeps frame 0 aligned and scales the length exactly', () => {
    const input = sine(44100, 1000, 44100)
    const output = resample(input, 44100, 48000)
    expect(output.length).toBe(resampledLength(44100, 44100, 48000))
    expect(output.length).toBe(48000)
    const expected = sine(48000, 1000, 48000)
    let worst = 0
    for (let i = 100; i < 47900; i++)
      worst = Math.max(worst, Math.abs((output[i] ?? 0) - (expected[i] ?? 0)))
    expect(worst).toBeLessThan(1e-3)
  })

  it('passes DC at unity and returns a copy at equal rates', () => {
    const output = resample(new Float32Array(2000).fill(0.25), 44100, 48000)
    expect(output[1000]).toBeCloseTo(0.25, 5)
    const input = new Float32Array([1, 2, 3])
    expect(resample(input, 48000, 48000)).not.toBe(input)
  })

  it('rejects non-integer rates', () => {
    expect(() => resample(new Float32Array(4), 44100.5, 48000)).toThrow(RangeError)
  })
})
