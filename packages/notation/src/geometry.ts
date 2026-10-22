import type * as alphaTab from '@coderline/alphatab'
import { noteOf } from './score.ts'
import type { BeatMarker, NotationTimeline, NoteMark, NoteRef, Rect } from './types.ts'

// Overlay geometry from alphaTab's boundsLookup (core.includeNoteBounds): bars to tap, the beat
// cursor, the current bar and loop shading, and the confidence marks drawn above the score
// (alphaTab documents that CSS styling of its own output isn't reliable, 26 §5). Coordinates are
// the render surface's pixels.

type Lookup = Pick<alphaTab.rendering.BoundsLookup, 'staffSystems'>

const rect = (b: { x: number; y: number; w: number; h: number }): Rect => ({
  x: b.x,
  y: b.y,
  w: b.w,
  h: b.h,
})

export interface BarBox extends Rect {
  /** alphaTab master bar index. */
  index: number
  system: number
}

/** One box per rendered bar: its full height on its staff system (the tap target). */
export function barBoxes(lookup: Lookup): BarBox[] {
  return lookup.staffSystems.flatMap((system) =>
    system.bars.map((bar) => ({
      index: bar.index,
      system: system.index,
      ...rect({
        x: bar.realBounds.x,
        y: system.realBounds.y,
        w: bar.realBounds.w,
        h: system.realBounds.h,
      }),
    })),
  )
}

/** Where a time falls: the alphaTab bar and the fraction of it played (metric beats, linear). */
export function barFraction(
  timeline: NotationTimeline,
  seconds: number,
): { index: number; fraction: number } | undefined {
  const { bars } = timeline
  if (bars.length === 0) return undefined
  const firstStart = bars[0]?.beats[0] ?? 0
  if (seconds < firstStart) return { index: 0, fraction: 0 }
  let lo = 0
  let hi = bars.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((bars[mid]?.beats[0] ?? Number.POSITIVE_INFINITY) <= seconds) lo = mid
    else hi = mid - 1
  }
  const beats = bars[lo]?.beats ?? []
  const barEnd = bars[lo + 1]?.beats[0] ?? timeline.end
  if (seconds >= barEnd) return { index: lo, fraction: 1 }
  let beat = 0
  while (beat + 1 < beats.length && (beats[beat + 1] ?? 0) <= seconds) beat++
  const start = beats[beat] ?? 0
  const next = beats[beat + 1] ?? barEnd
  const within = next > start ? (seconds - start) / (next - start) : 0
  return { index: lo, fraction: Math.min(1, (beat + within) / Math.max(1, beats.length)) }
}

export interface CursorPosition extends Rect {
  index: number
}

// The beat cursor: inside the bar, x interpolates between the rendered beats around the playing
// tick (so it sits on a note when the note sounds), and between the last beat and the bar end.
export function cursorAt(
  lookup: Lookup,
  score: alphaTab.model.Score,
  timeline: NotationTimeline,
  seconds: number,
): CursorPosition | undefined {
  const where = barFraction(timeline, seconds)
  if (!where) return undefined
  const masterBar = score.masterBars[where.index]
  const bounds = findMasterBar(lookup, where.index)
  if (!masterBar || !bounds) return undefined
  const system = bounds.staffSystemBounds?.realBounds ?? bounds.realBounds
  const tick = where.fraction * masterBar.calculateDuration()
  const beats = bounds.bars[0]?.beats ?? []
  const left = bounds.realBounds.x
  const right = bounds.realBounds.x + bounds.realBounds.w
  let x = left + where.fraction * bounds.realBounds.w
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i] as alphaTab.rendering.BeatBounds
    const start = beat.beat.playbackStart
    const end = beats[i + 1]?.beat.playbackStart ?? masterBar.calculateDuration()
    if (tick < start || tick >= end) continue
    const from = i === 0 ? Math.min(beat.onNotesX, left) : beat.onNotesX
    const to = beats[i + 1]?.onNotesX ?? right
    x = from + ((tick - start) / Math.max(1, end - start)) * (to - from)
    break
  }
  return { index: where.index, x, y: system.y, w: 2, h: system.h }
}

function findMasterBar(lookup: Lookup, index: number) {
  for (const system of lookup.staffSystems) {
    for (const bar of system.bars) if (bar.index === index) return bar
  }
  return undefined
}

export interface NoteBox extends Rect, NoteMark {
  noteId: string
}

/** Boxes around the fret numbers (or noteheads) of every mapped note. */
export function noteBoxes(
  lookup: Pick<alphaTab.rendering.BoundsLookup, 'findBeat'>,
  score: alphaTab.model.Score,
  noteMap: readonly NoteRef[],
  marks: ReadonlyMap<string, NoteMark>,
): NoteBox[] {
  return noteMap.flatMap((ref) => {
    const note = noteOf(score, ref)
    if (!note) return []
    const bounds = lookup.findBeat(note.beat)?.notes?.find((n) => n.note === note)
    if (!bounds) return []
    return [
      {
        noteId: ref.noteId,
        ...rect(bounds.noteHeadBounds),
        ...(marks.get(ref.noteId) ?? { level: 'high' as const }),
      },
    ]
  })
}

export interface MarkerBox extends Rect {
  noteId: string
  label: string
}

/** "!" markers for notes without a fret position, on the beat they would sound. */
export function markerBoxes(
  lookup: Lookup,
  score: alphaTab.model.Score,
  timeline: NotationTimeline,
  markers: readonly BeatMarker[],
): MarkerBox[] {
  return markers.flatMap((marker) => {
    const at = cursorAt(lookup, score, timeline, marker.time)
    return at ? [{ noteId: marker.noteId, label: marker.label, x: at.x, y: at.y, w: 0, h: 0 }] : []
  })
}
