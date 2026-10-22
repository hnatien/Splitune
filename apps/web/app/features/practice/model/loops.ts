import { PPQ, tickToTime, timeToTick } from '@splitune/music-core'
import type { PracticeGrid } from './grid'

// Loops (12 §5): tap bar A, then bar B → the loop spans both (single pointer, WCAG 2.5.7); tapping
// A again loops that one bar. Numeric "bars 17–20" fields set the same range, and either edge
// nudges by a sixteenth. Times are on the PCM timeline; bars are the grid's 0-based bar_index.

export interface LoopRange {
  startBar: number
  endBar: number
  start: number
  end: number
}

export type LoopSelection =
  | { kind: 'none' }
  | { kind: 'armed'; bar: number }
  | { kind: 'active'; range: LoopRange }

export function barRange(grid: PracticeGrid, a: number, b: number): LoopRange {
  const startBar = Math.max(grid.firstBar, Math.min(a, b))
  const endBar = Math.max(startBar, Math.max(a, b))
  return { startBar, endBar, start: grid.barStart(startBar), end: grid.barEnd(endBar) }
}

export function tapBar(selection: LoopSelection, bar: number, grid: PracticeGrid): LoopSelection {
  if (selection.kind === 'armed')
    return { kind: 'active', range: barRange(grid, selection.bar, bar) }
  return { kind: 'armed', bar }
}

/** Moves one edge by a sixteenth note (on the beat grid, so it follows the tempo there). */
export function nudge(
  grid: PracticeGrid,
  range: LoopRange,
  edge: 'start' | 'end',
  direction: 1 | -1,
): LoopRange {
  const tick = timeToTick(grid.grid, range[edge]) + (direction * PPQ) / 4
  const time = tickToTime(grid.grid, tick)
  const next = { ...range, [edge]: Math.max(0, time) }
  // Keep at least a sixteenth inside the loop.
  const min = tickToTime(grid.grid, timeToTick(grid.grid, next.start) + PPQ / 4)
  if (next.end < min) return range
  return next
}

/** The loop's 1-based beat positions for the saved clip (contract: bars 0-based, beats 1-based). */
export function clipBeats(
  grid: PracticeGrid,
  range: LoopRange,
): { start_bar: number; start_beat: number; end_bar: number; end_beat: number } {
  const start = grid.positionAt(range.start + 1e-6)
  const end = grid.positionAt(range.end - 1e-6)
  return { start_bar: start.bar, start_beat: start.beat, end_bar: end.bar, end_beat: end.beat }
}

/** One bar, or the loop's length, at the loop's tempo: how long a rest lasts (12 §5). */
export function restSeconds(
  grid: PracticeGrid | null,
  range: LoopRange,
  rest: 'none' | 'beat' | 'bar',
): number {
  if (rest === 'none') return 0
  if (!grid) return rest === 'bar' ? 2 : 0.5
  const beats = grid.beatsOf(range.endBar)
  const barLength = grid.barEnd(range.endBar) - grid.barStart(range.endBar)
  return rest === 'bar' ? barLength : barLength / Math.max(1, beats.length)
}
