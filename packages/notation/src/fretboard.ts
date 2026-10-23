import type { RollBand } from './piano-roll.tsx'

// Fretboard geometry for guitar and bass Notes (21 V4, step 18b): shared by the lanes (GuitarRoll)
// and the neck beside them (FretboardDiagram) so each string's lane continues its string on the
// neck. Frets are spaced like a real neck (each a twelfth root of two shorter), compressed so the
// first twelve stay usable; the neck shows a window of five to nine frets that follows the part,
// one key per half bar, and starts moving a little before the notes that need it.

export interface FretNote {
  id: string
  /** 1 = the highest string, as in TabEvent. */
  string: number
  /** Relative to the capo; 0 = open. */
  fret: number
  /** Seconds on the decoded-PCM timeline. */
  t0: number
  t1: number
  band: RollBand
  /** Moved by octaves into the tuning's range (26 §5): a marker, never a dashed outline. */
  octave?: '8va' | '8vb' | undefined
}

/** The fret spaces the neck shows: `lo` to `hi`, both included; `lo` 1 shows the nut. */
export interface FretWindow {
  lo: number
  hi: number
}

/** The window the neck moves to for the notes from `t`. */
export interface FretKey extends FretWindow {
  t: number
}

export const FRET_SPACES = { min: 5, max: 9 }
/** Seconds before a key's time that the neck moves to it. */
export const REFRAME_LEAD = 0.5
/** Onsets this close together are one strum, read as one shape. */
export const STRUM_S = 0.035
/** Single inlay dots by fret (12 and 24 have two). */
export const INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21])

/** A wire's distance from the nut in fret units (wire 1 = 1): the real neck's spacing, compressed
 * toward even so the higher frets don't shrink below a fingertip. */
export function fretUnit(wire: number): number {
  return 0.55 * wire + 0.45 * ((1 - 2 ** (-wire / 12)) / (1 - 2 ** (-1 / 12)))
}

/** Where a wire sits across the window, 0 at the wire before `lo` and 1 at `hi`'s. */
export function wireAt(window: FretWindow, wire: number): number {
  const start = fretUnit(window.lo - 1)
  return (fretUnit(wire) - start) / (fretUnit(window.hi) - start)
}

/** The middle of a fret space across the window, as `wireAt`. */
export function spaceAt(window: FretWindow, fret: number): number {
  return (wireAt(window, fret - 1) + wireAt(window, fret)) / 2
}

/** The window that holds frets `low` to `high`: the nut in view when the lowest is at fret 3 or
 * below, five to nine frets wide (a wider stretch keeps its lowest; the rest get the shift cue). */
function windowFor(low: number, high: number): FretWindow {
  const lo = low <= 3 ? 1 : low
  return { lo, hi: Math.min(lo + FRET_SPACES.max - 1, Math.max(high, lo + FRET_SPACES.min - 1)) }
}

const holds = (window: FretWindow | undefined, fret: number) =>
  fret === 0 || (window !== undefined && fret >= window.lo && fret <= window.hi)

/** The neck's keys, bar by bar (`bars`: their start times): it stays put while the notes fit, and
 * moves for a bar's notes (or half a bar's, when the bar needs more than nine frets) from the
 * first note that doesn't fit, so it re-frames as rarely and as late as it can. */
export function fretKeys(notes: readonly FretNote[], bars: readonly number[]): FretKey[] {
  const keys: FretKey[] = []
  let i = 0
  const place = (from: number, to: number) => {
    while (i < notes.length && (notes[i] as FretNote).t0 < from) i++
    let end = i
    while (end < notes.length && (notes[end] as FretNote).t0 < to) end++
    const stretch = notes.slice(i, end).filter((n) => n.fret > 0)
    const current = keys[keys.length - 1]
    const first = stretch.find((n) => !holds(current, n.fret))
    if (!first) return true
    const frets = stretch.map((n) => n.fret)
    const low = Math.min(...frets)
    const high = Math.max(...frets)
    if (high - (low <= 3 ? 1 : low) >= FRET_SPACES.max) return false
    keys.push({ t: current ? first.t0 : from, ...windowFor(low, high) })
    return true
  }
  for (let b = 0; b < bars.length; b++) {
    const from = bars[b] as number
    const to = bars[b + 1] ?? Number.POSITIVE_INFINITY
    if (place(from, to)) continue
    const middle = Number.isFinite(to) ? (from + to) / 2 : from
    for (const [a, z] of [
      [from, middle],
      [middle, to],
    ] as const) {
      if (place(a, z)) continue
      // Wider than the neck even in half a bar: the window holds its lowest notes.
      const stretch = notes.filter((n) => n.t0 >= a && n.t0 < z && n.fret > 0)
      const current = keys[keys.length - 1]
      const outside = stretch.find((n) => !holds(current, n.fret)) as FretNote
      const frets = stretch.map((n) => n.fret)
      keys.push({
        t: current ? outside.t0 : a,
        ...windowFor(Math.min(...frets), Math.max(...frets)),
      })
    }
  }
  return keys
}

const FIRST: FretWindow = { lo: 1, hi: FRET_SPACES.min }

/** The window the neck shows at `t` (a key takes over `REFRAME_LEAD` before its time). In a loop's
 * last moments it is already the loop start's, so the wrap needs no move. */
export function fretWindowAt(
  keys: readonly FretKey[],
  t: number,
  loop?: { t0: number; t1: number } | null,
): FretWindow {
  const at = loop && t >= loop.t1 - REFRAME_LEAD && t < loop.t1 && t >= loop.t0 ? loop.t0 : t
  let lo = 0
  let hi = keys.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((keys[mid] as FretKey).t - REFRAME_LEAD <= at) lo = mid + 1
    else hi = mid
  }
  const key = keys[lo - 1] ?? keys[0]
  return key ? { lo: key.lo, hi: key.hi } : FIRST
}

export interface NoteGroup<T> {
  t0: number
  notes: T[]
}

/** Notes (by onset) as strums: onsets within `STRUM_S` of a group's first are one shape. */
export function noteGroups<T extends { t0: number }>(notes: readonly T[]): NoteGroup<T>[] {
  const groups: NoteGroup<T>[] = []
  for (const note of notes) {
    const last = groups[groups.length - 1]
    if (last && note.t0 - last.t0 < STRUM_S) last.notes.push(note)
    else groups.push({ t0: note.t0, notes: [note] })
  }
  return groups
}

/** The first group to start after `t`; in a loop, the loop's first one once its end comes. */
export function groupAfter<T>(
  groups: readonly NoteGroup<T>[],
  t: number,
  loop?: { t0: number; t1: number } | null,
): NoteGroup<T> | undefined {
  const first = (from: number) => {
    let lo = 0
    let hi = groups.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((groups[mid] as NoteGroup<T>).t0 <= from) lo = mid + 1
      else hi = mid
    }
    return groups[lo]
  }
  const next = first(t)
  if (!loop || t < loop.t0 || t >= loop.t1 || (next && next.t0 < loop.t1)) return next
  return first(loop.t0 - 1e-6)
}

/** Bar and fret numbers for fret digits `readPx` high: 0.6 of them, never below 11 px. */
export function labelPx(readPx: number): number {
  return Math.max(11, Math.round(readPx * 0.6))
}

/** The rows the strings sit on in a box `height` tall, for fret digits `readPx` high: chord names
 * (0.75 of them) and bar numbers (`labelPx`, or smaller) over the lanes, fret numbers under the
 * neck. Lanes and neck share it, so they line up. */
export function stringRows(
  height: number,
  strings: number,
  readPx: number,
): { top: number; lane: number; head: number; foot: number } {
  const head = Math.round(readPx * 0.75 + labelPx(readPx)) + 14
  const foot = Math.round(Math.max(12, readPx * 0.5)) + 10
  const lane = Math.max(0, Math.min(readPx * 1.8, (height - head - foot - 8) / strings))
  const top = head + Math.max(0, (height - head - foot - lane * strings) * 0.45)
  return { top, lane, head, foot }
}

/** The middle of a string's row (string 1 on top, as in tab). */
export function rowAt(rows: { top: number; lane: number }, string: number): number {
  return rows.top + (string - 0.5) * rows.lane
}

/** The largest fret digits that still leave lanes 1.3 times their height in a box `height` tall:
 * the reading size gives way only on a short paper (a phone in landscape). */
export function fitReadPx(height: number, strings: number): number {
  let lo = 0
  let hi = 200
  for (let i = 0; i < 24; i++) {
    const px = (lo + hi) / 2
    if (stringRows(height, strings, px).lane >= px * 1.3) lo = px
    else hi = px
  }
  return lo
}
