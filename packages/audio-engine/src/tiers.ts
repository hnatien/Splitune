// CPU tiers and degradation (docs/specs/11-audio-engine.md §6). Tiers only ever step
// down within a session: high (default preset) → mid (cheaper preset, split computation) → low
// (also no pitch shift). Each step reports `audio_underrun` for telemetry.

export type Tier = 'high' | 'mid' | 'low'

export type UnderrunReason = 'load' | 'glitch'

export interface UnderrunEvent {
  tier: Tier
  previous: Tier
  reason: UnderrunReason
  // Worklet processing time over audio time in the window that tripped (load), if known.
  load: number | undefined
}

// Worklet load above this for LOAD_WINDOWS consecutive ~1 s windows means no headroom left.
export const LOAD_LIMIT = 0.75
export const LOAD_WINDOWS = 2
// Context time falling this far behind wall time within one check means the device ran dry.
export const GLITCH_SECONDS = 0.02

interface DeviceHints {
  // navigator.deviceMemory (GB; Chromium only).
  deviceMemory?: number | undefined
  // navigator.hardwareConcurrency.
  hardwareConcurrency?: number | undefined
}

// Mid-range phones start on the cheaper preset. Only Chromium reports memory; others start high
// and step down on their own measurements.
export function initialTier(hints: DeviceHints): Tier {
  const lowMemory = hints.deviceMemory !== undefined && hints.deviceMemory <= 4
  const fewCores = hints.hardwareConcurrency !== undefined && hints.hardwareConcurrency <= 4
  return lowMemory && fewCores ? 'mid' : 'high'
}

export function nextTier(tier: Tier): Tier {
  return tier === 'high' ? 'mid' : 'low'
}

export class UnderrunMonitor {
  #tier: Tier
  #hotWindows = 0
  #lastCheck: { context: number; wall: number } | undefined
  readonly #onStep: (event: UnderrunEvent) => void
  readonly #adaptive: boolean

  // With `adaptive` off (fixed-tier measurements, P7) underruns are reported but the tier stays.
  constructor(tier: Tier, onStep: (event: UnderrunEvent) => void, adaptive = true) {
    this.#tier = tier
    this.#onStep = onStep
    this.#adaptive = adaptive
  }

  get tier(): Tier {
    return this.#tier
  }

  // A worklet load report (processing time / audio time over ~1 s).
  load(load: number): void {
    this.#hotWindows = load > LOAD_LIMIT ? this.#hotWindows + 1 : 0
    if (this.#hotWindows >= LOAD_WINDOWS) {
      this.#hotWindows = 0
      this.#step('load', load)
    }
  }

  // A periodic sample of AudioContext.currentTime against performance.now() (ms) while playing.
  // Call reset() whenever playback stops, so pauses don't read as glitches.
  sample(contextTime: number, wallTime: number): void {
    const last = this.#lastCheck
    this.#lastCheck = { context: contextTime, wall: wallTime }
    if (!last) return
    const behind = (wallTime - last.wall) / 1000 - (contextTime - last.context)
    if (behind > GLITCH_SECONDS) this.#step('glitch', undefined)
  }

  reset(): void {
    this.#lastCheck = undefined
    this.#hotWindows = 0
  }

  #step(reason: UnderrunReason, load: number | undefined): void {
    const previous = this.#tier
    if (!this.#adaptive) {
      this.#onStep({ tier: previous, previous, reason, load })
      return
    }
    if (previous === 'low') return
    this.#tier = nextTier(previous)
    this.#onStep({ tier: this.#tier, previous, reason, load })
  }
}
