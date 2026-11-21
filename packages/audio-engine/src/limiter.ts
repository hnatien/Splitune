// The master's safety limiter (docs/specs/12-practice-screen-and-notation.md §7, WHO H.870):
// nothing the engine plays goes above 0 dBFS, whatever the mix, the solo gains or the helpers
// added on top. A stereo-linked peak limiter without lookahead (so it adds no latency to the
// clock): the gain drops at once to what keeps the loudest sample at the ceiling and recovers
// with a smooth release. The mixer's own rule keeps the loudest fader at unity, so it acts only
// where stems sum over full scale.

const RELEASE_SECONDS = 0.08

export class PeakLimiter {
  readonly #ceiling: number
  readonly #release: number
  #gain = 1
  #lowest = 1

  constructor(sampleRate: number, ceiling = 1) {
    this.#ceiling = ceiling
    this.#release = Math.exp(-1 / (RELEASE_SECONDS * sampleRate))
  }

  // Limits one block in place; `right` may be the same array as `left` (mono output).
  process(left: Float32Array, right: Float32Array): void {
    const stereo = right !== left
    let gain = this.#gain
    for (let i = 0; i < left.length; i++) {
      const l = left[i] ?? 0
      const r = stereo ? (right[i] ?? 0) : l
      const peak = Math.max(Math.abs(l), Math.abs(r))
      const target = peak > this.#ceiling ? this.#ceiling / peak : 1
      // Instant attack; the release approaches the target from below, never past it.
      gain = target < gain ? target : target - (target - gain) * this.#release
      if (gain < this.#lowest) this.#lowest = gain
      left[i] = l * gain
      if (stereo) right[i] = r * gain
    }
    this.#gain = gain
  }

  // The deepest gain reduction since the last call, in dB (≤ 0), for diagnostics and tests.
  takeReductionDb(): number {
    const lowest = this.#lowest
    this.#lowest = this.#gain
    return 20 * Math.log10(lowest)
  }
}
