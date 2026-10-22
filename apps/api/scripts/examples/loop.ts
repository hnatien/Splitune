import type { Beats, Notes } from '@splitune/contracts'
import type { z } from 'zod'

// The example's suggested phrase (13 §1 "suggested 2–4 bar phrase"): four bars, or two when bars
// are long (slow songs), chosen where the part plays most and the transcription is surest. The
// first and last bars are left out (count-in run-up, a possibly cut-off ending). Without notes
// (chords-only parts) the earliest full window wins.

type BeatsDoc = z.infer<typeof Beats>
type NotesDoc = z.infer<typeof Notes>

export interface SuggestedLoop {
  start_bar: number
  end_bar: number
}

const LONG_BAR_S = 3.2

export function suggestLoop(beats: BeatsDoc, notes: NotesDoc | undefined): SuggestedLoop {
  const starts = new Map<number, number>()
  for (const beat of beats.beats) {
    if (beat.bar_index >= 0 && !starts.has(beat.bar_index)) starts.set(beat.bar_index, beat.t)
  }
  const bars = [...starts.keys()].sort((a, b) => a - b)
  // A bar's end is the next bar's start, so the last bar with a known start has no full span.
  const full = bars.slice(0, -1)
  if (full.length === 0) throw new Error('the beat grid has no complete bar')
  const end = (bar: number) => starts.get(bar + 1) ?? beats.duration_s
  const meanBar =
    full.reduce((sum, bar) => sum + (end(bar) - (starts.get(bar) ?? 0)), 0) / full.length
  const length = Math.min(meanBar > LONG_BAR_S ? 2 : 4, full.length)
  const inner = full.length - length >= 2 ? full.slice(1, -1) : full
  const candidates = inner.slice(0, Math.max(1, inner.length - length + 1))

  let best: { bar: number; score: number } | undefined
  for (const bar of candidates) {
    const from = starts.get(bar) ?? 0
    const to = end(bar + length - 1)
    const inside = (notes?.notes ?? []).filter((n) => n.onset_s >= from && n.onset_s < to)
    const confidence =
      inside.length === 0 ? 0 : inside.reduce((sum, n) => sum + n.confidence, 0) / inside.length
    // Up to a note per beat counts as "the part plays"; denser passages earn nothing extra.
    const density = Math.min(1, inside.length / (length * beats.meter.numerator))
    const score = confidence * density
    if (!best || score > best.score + 1e-9) best = { bar, score }
  }
  const start = best?.bar ?? candidates[0] ?? 0
  return { start_bar: start, end_bar: start + length - 1 }
}
