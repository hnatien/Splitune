// Streaming statistics over decoded audio for the waveform preview and the pre-flight checks.

export type AudioStats = {
  durationS: number
  /** Peak |sample| per bin, 0–1. */
  peaks: number[]
  rmsDb: number
  /** Share of samples at full scale. */
  clippedFraction: number
  /** Share of 100 ms windows below −50 dBFS. */
  silentFraction: number
}

const BINS = 400
const CLIP = 0.999
const SILENT_DB = -50

/** Streaming accumulator over mono-mixed blocks of samples. */
export class StatsAccumulator {
  #sumSquares = 0
  #count = 0
  #clipped = 0
  #window: number
  #windowSum = 0
  #windowCount = 0
  #windows = 0
  #silentWindows = 0
  #blockPeaks: number[] = []

  constructor(sampleRate: number) {
    this.#window = Math.max(1, Math.round(sampleRate / 10))
  }

  add(samples: Float32Array) {
    let peak = 0
    for (const sample of samples) {
      const magnitude = Math.abs(sample)
      if (magnitude > peak) peak = magnitude
      if (magnitude >= CLIP) this.#clipped++
      const squared = sample * sample
      this.#sumSquares += squared
      this.#windowSum += squared
      if (++this.#windowCount === this.#window) {
        this.#closeWindow()
      }
    }
    this.#count += samples.length
    this.#blockPeaks.push(peak)
  }

  #closeWindow() {
    const rms = Math.sqrt(this.#windowSum / this.#windowCount)
    if (20 * Math.log10(rms || 1e-12) < SILENT_DB) this.#silentWindows++
    this.#windows++
    this.#windowSum = 0
    this.#windowCount = 0
  }

  finish(durationS: number): AudioStats {
    if (this.#windowCount > 0) this.#closeWindow()
    const rms = this.#count > 0 ? Math.sqrt(this.#sumSquares / this.#count) : 0
    return {
      durationS,
      peaks: binPeaks(this.#blockPeaks, BINS),
      rmsDb: 20 * Math.log10(rms || 1e-12),
      clippedFraction: this.#count > 0 ? this.#clipped / this.#count : 0,
      silentFraction: this.#windows > 0 ? this.#silentWindows / this.#windows : 1,
    }
  }
}

function binPeaks(blocks: number[], bins: number): number[] {
  if (blocks.length <= bins) return blocks
  return Array.from({ length: bins }, (_, i) => {
    const start = Math.floor((i * blocks.length) / bins)
    const end = Math.max(start + 1, Math.floor(((i + 1) * blocks.length) / bins))
    return Math.max(...blocks.slice(start, end))
  })
}
