// The helpers' input (the chord synth): heard with the stems, from the same frames, and through
// the same limiter (docs/specs/12-practice-screen-and-notation.md §7).
import { describe, expect, it } from 'vitest'
import { ProcessorCore } from '../src/core.ts'
import { peak, rms } from './analysis.ts'
import { dspModule } from './render.ts'
import { SAMPLE_RATE } from './scenarios.ts'
import { tone } from './signals.ts'

const QUANTUM = 128

function renderWith(input: (frame: number) => Float32Array[], stems: Int16Array[], seconds = 1) {
  const core = new ProcessorCore(
    dspModule,
    SAMPLE_RATE,
    960,
    () => undefined,
    () => 0,
  )
  stems.forEach((pcm, stem) => {
    core.receive({ type: 'load', stem, pcm })
  })
  core.receive({ type: 'play', countInBars: 0 })
  const frames = Math.ceil((seconds * SAMPLE_RATE) / QUANTUM) * QUANTUM
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  for (let frame = 0; frame < frames; frame += QUANTUM) {
    core.render(
      frame,
      left.subarray(frame, frame + QUANTUM),
      right.subarray(frame, frame + QUANTUM),
      input(frame),
    )
  }
  return { left, right }
}

const constant = (value: number) => () => [new Float32Array(QUANTUM).fill(value)]

describe('helpers input', () => {
  it('adds a mono helper to both channels', () => {
    const silence = new Int16Array(SAMPLE_RATE * 2)
    const { left, right } = renderWith(constant(0.25), [silence])
    expect(rms(left, 1000, 2000)).toBeCloseTo(0.25, 5)
    expect(rms(right, 1000, 2000)).toBeCloseTo(0.25, 5)
  })

  it('adds a stereo helper channel by channel', () => {
    const silence = new Int16Array(SAMPLE_RATE * 2)
    const { left, right } = renderWith(
      () => [new Float32Array(QUANTUM).fill(0.1), new Float32Array(QUANTUM).fill(-0.2)],
      [silence],
    )
    expect(left[500]).toBeCloseTo(0.1, 6)
    expect(right[500]).toBeCloseTo(-0.2, 6)
  })

  it('limits the stems and the helper together at 0 dBFS', () => {
    const { left, right } = renderWith(constant(0.6), [tone(SAMPLE_RATE, 2, 220, 0.9)])
    expect(peak(left)).toBeLessThanOrEqual(1)
    expect(peak(right)).toBeLessThanOrEqual(1)
    expect(peak(left)).toBeGreaterThan(0.95)
  })

  it('plays the stems as before with no helper connected', () => {
    const with0 = renderWith(() => [], [tone(SAMPLE_RATE, 2, 220, 0.4)])
    const withEmpty = renderWith(
      () => [new Float32Array(QUANTUM)],
      [tone(SAMPLE_RATE, 2, 220, 0.4)],
    )
    expect(with0.left).toEqual(withEmpty.left)
  })
})
