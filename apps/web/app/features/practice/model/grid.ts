import {
  type BeatGrid,
  type Beats,
  barOfBeat,
  beatLabel,
  beatTime,
  createBeatGrid,
  PPQ,
  timeToTick,
} from '@splitune/music-core'
import type { BarTimes } from '@splitune/notation'

// The effective beat grid as the practice screen uses it: bar ↔ time lookups for loops, the chord
// strip, the timeline ruler and the notation's sync points. Bars are the 0-based bar_index
// (pickup -1); the UI shows them 1-based (27 §5.3).

export interface PracticeGrid {
  grid: BeatGrid
  bpm: number
  /** Bars that hold at least one detected beat, in order. */
  bars: number[]
  firstBar: number
  lastBar: number
  /** Beat index of a bar's downbeat (extrapolated outside the detected beats). */
  downbeatIndex(bar: number): number
  /** Start time of a bar (its downbeat). */
  barStart(bar: number): number
  /** End time of a bar (the next bar's downbeat). */
  barEnd(bar: number): number
  /** Metric beat times of a bar, downbeat first. */
  beatsOf(bar: number): number[]
  /** The bar and 1-based beat playing at a time. */
  positionAt(seconds: number): { bar: number; beat: number }
  times: BarTimes
}

export function practiceGrid(beats: Beats): PracticeGrid {
  const grid = createBeatGrid(beats)
  const n = grid.times.length
  const firstBar = grid.bars[0] ?? 0
  const lastBar = grid.bars[n - 1] ?? 0
  const downbeats = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const label = beatLabel(grid, i)
    if (label.beat === 1 && !downbeats.has(label.bar)) downbeats.set(label.bar, i)
  }
  // A pickup bar starts on its first beat, which is not beat 1.
  if (!downbeats.has(firstBar)) downbeats.set(firstBar, 0)
  const downbeatIndex = (bar: number): number => {
    const known = downbeats.get(bar)
    if (known !== undefined) return known
    if (bar > lastBar) {
      let i = downbeats.get(lastBar) ?? n - 1
      for (let b = lastBar; b < bar; b++) i += barOfBeat(grid, i).length
      return i
    }
    let i = downbeats.get(firstBar) ?? 0
    for (let b = firstBar; b > bar; b--) i -= grid.beatsPerBar
    return i
  }
  const beatsOf = (bar: number): number[] => {
    const start = downbeatIndex(bar)
    const end = downbeatIndex(bar + 1)
    return Array.from({ length: Math.max(1, end - start) }, (_, k) => beatTime(grid, start + k))
  }
  const bars: number[] = []
  for (let bar = firstBar; bar <= lastBar; bar++) bars.push(bar)
  return {
    grid,
    bpm: beats.bpm,
    bars,
    firstBar,
    lastBar,
    downbeatIndex,
    barStart: (bar) => beatTime(grid, downbeatIndex(bar)),
    barEnd: (bar) => beatTime(grid, downbeatIndex(bar + 1)),
    beatsOf,
    positionAt: (seconds) => beatLabel(grid, Math.floor(timeToTick(grid, seconds) / PPQ)),
    times: { firstBar, beatsOf },
  }
}

/** The bar whose span contains a time (clamped to the detected bars). */
export function barAt(grid: PracticeGrid, seconds: number): number {
  const { bar } = grid.positionAt(seconds)
  return Math.min(grid.lastBar, Math.max(grid.firstBar, bar))
}
