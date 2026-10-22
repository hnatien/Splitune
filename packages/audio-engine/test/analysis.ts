// Measurements on rendered audio, shared by the Node tests and the browser harness
// (docs/implementation/18-testing-strategy.md §2).
import type { ProcessorEvent } from '../src/protocol.ts'

type Position = Extract<ProcessorEvent, { type: 'position' }>

export function allFinite(signal: Float32Array): boolean {
  for (const sample of signal) if (!Number.isFinite(sample)) return false
  return true
}

export function rms(signal: Float32Array, from = 0, to = signal.length): number {
  let sum = 0
  for (let i = from; i < to; i++) sum += (signal[i] ?? 0) ** 2
  return Math.sqrt(sum / Math.max(1, to - from))
}

export function peak(signal: Float32Array, from = 0, to = signal.length): number {
  let max = 0
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(signal[i] ?? 0))
  return max
}

// Fundamental of a steady tone from linearly interpolated rising zero crossings.
export function frequency(signal: Float32Array, sampleRate: number, from: number, to: number) {
  let first = -1
  let last = -1
  let crossings = 0
  for (let i = from + 1; i < to; i++) {
    const a = signal[i - 1] ?? 0
    const b = signal[i] ?? 0
    if (a < 0 && b >= 0) {
      const at = i - 1 + a / (a - b)
      if (first < 0) first = at
      last = at
      crossings++
    }
  }
  return crossings < 2 ? 0 : ((crossings - 1) * sampleRate) / (last - first)
}

export function cents(frequency: number, reference: number): number {
  return 1200 * Math.log2(frequency / reference)
}

// Frames where |x| first reaches `threshold` × the signal's peak after `minGap` frames below it.
export function onsets(signal: Float32Array, threshold: number, minGap: number): number[] {
  const level = threshold * peak(signal)
  const found: number[] = []
  let quiet = minGap
  for (let i = 0; i < signal.length; i++) {
    if (Math.abs(signal[i] ?? 0) >= level) {
      if (quiet >= minGap) found.push(i)
      quiet = 0
    } else {
      quiet++
    }
  }
  return found
}

// Largest |x[n] − 2x[n−1] + x[n−2]| in a range: steps and clicks show up as spikes.
export function maxCurvature(signal: Float32Array, from: number, to: number): number {
  let max = 0
  for (let i = Math.max(2, from); i < Math.min(signal.length, to); i++) {
    const value = (signal[i] ?? 0) - 2 * (signal[i - 1] ?? 0) + (signal[i - 2] ?? 0)
    max = Math.max(max, Math.abs(value))
  }
  return max
}

export function interleavedChannel(pcm: Int16Array, channel = 0): Float32Array {
  const out = new Float32Array(pcm.length >> 1)
  for (let i = 0; i < out.length; i++) out[i] = (pcm[2 * i + channel] ?? 0) / 32768
  return out
}

// Heard source frame at an output frame, extrapolated from the latest report at or before it.
export function heardAt(reports: Position[], frame: number): number | undefined {
  let latest: Position | undefined
  for (const report of reports) {
    if (report.frame > frame) break
    latest = report
  }
  if (latest?.transport !== 'playing') return latest?.heard
  return latest.heard + (frame - latest.frame) * latest.rate
}
