import type { CalibrationTable, ConfidenceBand } from '../types.ts'

export interface BandThresholds {
  high: number
  medium: number
}

// Used when no calibration table is available (proposal until P2 fits real tables).
export const DEFAULT_BANDS: BandThresholds = { high: 0.7, medium: 0.4 }

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

// Piecewise-linear lookup over the isotonic knots, clamped outside the fitted range.
export function calibrate(raw: number, table: CalibrationTable): number {
  const { knots } = table
  if (table.method === 'identity' || knots.length === 0) return clamp01(raw)
  const first = knots[0] as [number, number]
  const last = knots.at(-1) as [number, number]
  if (raw <= first[0]) return clamp01(first[1])
  if (raw >= last[0]) return clamp01(last[1])
  let lo = 0
  let hi = knots.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((knots[mid] as [number, number])[0] <= raw) lo = mid
    else hi = mid
  }
  const [x0, y0] = knots[lo] as [number, number]
  const [x1, y1] = knots[hi] as [number, number]
  return clamp01(x1 === x0 ? y1 : y0 + ((raw - x0) / (x1 - x0)) * (y1 - y0))
}

export function confidenceBand(
  confidence: number,
  bands: BandThresholds = DEFAULT_BANDS,
): ConfidenceBand {
  if (confidence >= bands.high) return 'high'
  if (confidence >= bands.medium) return 'medium'
  return 'low'
}

export function calibrateWithBand(
  raw: number,
  table: CalibrationTable,
): { confidence: number; band: ConfidenceBand } {
  const confidence = calibrate(raw, table)
  return { confidence, band: confidenceBand(confidence, table.bands) }
}
