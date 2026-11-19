import { oneInBand } from './getting-ready'

// Uncertainty as a frequency (26 §5, 27 §5.3): "about 1 in 3", "we'd guess wrong about 1 time in
// 3"; never a percentage or a probability. Every surface rounds with the one rule of `oneInBand`:
// the nearest of 1 in 2 / 3 / 4 / 5 / 10 / 20.

/** The n of "about 1 in n" for a candidate's probability; anything rarer than 1 in 20 reads 20. */
export function oneIn(prob: number): number {
  return oneInBand(Math.min(1, prob)) ?? 20
}

/**
 * The n of "we'd guess wrong about 1 time in n" for a calibrated confidence, or for a band from
 * the confidences of the marks in it (their mean). Null when there is nothing to speak for.
 */
export function wrongOneIn(confidence: number | readonly number[]): number | null {
  const values = typeof confidence === 'number' ? [confidence] : confidence
  if (values.length === 0) return null
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return oneIn(1 - Math.min(1, Math.max(0, mean)))
}
