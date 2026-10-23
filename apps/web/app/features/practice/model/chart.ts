import type { PracticeGrid } from './grid'
import { type ChordModel, chordsInBar } from './view-model'

// The chord chart's layout (lead-sheet conventions, as pianists read them): four bars to a line,
// each chord written once where it changes, over the beat it starts on; the bars it carries on
// through show only their beat slashes. A run of bars without a chord reads "N.C." once.

export const BARS_PER_LINE = 4

export interface ChartChord {
  chord: ChordModel
  /** 0-based beat of the bar the chord starts on (0 when it carries in from before). */
  beat: number
}

export interface ChartBar {
  bar: number
  /** Beats in the bar: one slash each. */
  beats: number
  /** The chords written in this bar, in time order, at most one per beat. */
  chords: ChartChord[]
  /** The first bar of a run without a chord, written "N.C.". */
  noChord: boolean
}

export interface ChartLine {
  bars: ChartBar[]
}

const EPS = 1e-3

export function chartLines(
  grid: PracticeGrid,
  chords: readonly ChordModel[],
  barsPerLine = BARS_PER_LINE,
): ChartLine[] {
  const lines = new Map<number, ChartBar[]>()
  // The name last written ("" before the first; null after an N.C.).
  let written: string | null = ''
  for (const bar of grid.bars) {
    const times = grid.beatsOf(bar)
    const inBar = chordsInBar(chords, grid, bar)
    const out: ChartChord[] = []
    for (const chord of inBar) {
      if (chord.name === written) continue
      written = chord.name
      let beat = 0
      for (let i = 0; i < times.length; i++) if ((times[i] as number) <= chord.t0 + EPS) beat = i
      // Two changes on one beat: the later one is what sounds from the next beat on.
      if (out.at(-1)?.beat === beat) out.pop()
      out.push({ chord, beat })
    }
    const noChord = inBar.length === 0 && written !== null
    if (inBar.length === 0) written = null
    const line = bar < 0 ? -1 : Math.floor(bar / barsPerLine)
    lines.set(line, [
      ...(lines.get(line) ?? []),
      { bar, beats: times.length, chords: out, noChord },
    ])
  }
  return [...lines.values()].map((bars) => ({ bars }))
}
