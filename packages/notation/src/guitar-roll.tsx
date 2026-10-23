import { useEffect, useRef } from 'react'
import { type FretNote, noteGroups, rowAt, stringRows } from './fretboard.ts'

// Guitar and bass Notes lanes (21 V4, step 18b; ux/music-display-ui: tab is the guitar
// convention): one lane per string in tab order (string 1 on top), the part moving right to left
// onto the hit line at the left edge, where the FretboardDiagram's neck continues the strings.
// Every note carries its fret number at the reading size; a strum is one stacked shape with a
// rule through it; chord names and bar numbers sit over the bar lines as on the tab; sustain is a tail. The
// instrument's hue tints the notes and draws the tails; the ink outline carries the contrast, and
// strings differ by position, never colour (26 §4.4). Uncertain notes stay untinted with the score's
// dashed outline, low ones a "?" (26 §5); a note moved by octaves carries 8va/8vb. Drawn on a canvas from
// the clock every frame (12 §3: the display never owns the clock); a loop's next pass is drawn
// past its end, so the wrap never blanks; with reduced motion the lanes hold still for a page and
// only the playhead moves.

export interface GuitarRollTheme {
  family: string
  tabPx: number
  barNumberPx: number
  paper: string
  ink: string
  staff: string
  playhead: string
  loopFill: string
  loopEdge: string
  medium: string
  low: string
  /** The instrument's mark on the score (--fret-guitar or --fret-bass): tails and the note tint. */
  accent: string
}

export interface GuitarRollProps {
  /** By onset, frets relative to the capo. */
  notes: readonly FretNote[]
  strings: number
  /** Playback position in seconds. */
  clock: () => number
  /** Seconds from the hit line to the right edge. */
  span: number
  /** Bar starts with their labels ("12"), and the beat times between them. */
  bars: readonly { t: number; label: string }[]
  beats: readonly number[]
  /** Where the chord changes, its name as spelled for the song, and whether it's unsure. */
  chords: readonly { t: number; name: string; low: boolean }[]
  /** Notes with no place on the neck (26 §5 "!"). */
  markers: readonly { t: number; label: string }[]
  loop: { t0: number; t1: number } | null
  /** Reduced motion: the start of the page that holds a time (the lanes step page by page). */
  page?: ((t: number) => number) | undefined
  showUncertainty: boolean
  theme: GuitarRollTheme
  /** A click on the lanes: the time under the pointer. */
  onTimeActivate?: (t: number) => void
  className?: string
}

// The hit line's x; the frame loop allocates nothing, so everything it reuses is prepared here.
const HIT = 2
const FRET_LABELS = Array.from({ length: 25 }, (_, fret) => String(fret))
// A chord name's parts as ChordSymbol sets them (26 §12.2, step 17d): letter, ♭/♯ lifted, minor's
// "m" on the line, the quality raised and smaller, a slash bass slightly smaller.
const PART_STYLES = [
  { size: 1, rise: 0, weight: 700 },
  { size: 0.8, rise: -0.16, weight: 600 },
  { size: 1, rise: 0, weight: 700 },
  { size: 0.68, rise: -0.38, weight: 650 },
  { size: 0.88, rise: 0, weight: 650 },
] as const

/** A stretch of the timeline in view, with the offset that places it: past a loop's end the view
 * shows the next pass, clipped at the loop end. */
export interface Stretch {
  a: number
  b: number
  off: number
  clip: number
}

interface Chord {
  t: number
  /** Text per part style (empty when absent). */
  parts: string[]
  low: boolean
  widths: number[]
}

interface Prepared {
  notes: readonly FretNote[]
  /** Per note: the onset of its strum (where it's drawn) and the time to the next note on its
   * string (its head never runs into that one). */
  anchor: Float64Array
  gap: Float64Array
  /** Strums of two or more notes: onset, top and bottom string. */
  shapes: { t: number; top: number; bottom: number }[]
  longest: number
  chords: Chord[]
}

interface Style {
  key: string
  digit: string
  digitWidths: number[]
  number: string
  mark: string
  query: string
  parts: string[]
  chordPx: number
}

interface Frame {
  props: GuitarRollProps
  prepared: Prepared
  style: Style | null
  stretches: Stretch[]
  /** The lanes, drawn once per size and theme. */
  lanes: HTMLCanvasElement | null
  lanesKey: string
}

function chordParts(name: string): string[] {
  const match = /^([A-G])([#b♯♭]?)(.*?)(?:\/([A-G][#b♯♭]?))?$/.exec(name)
  if (!match) return [name, '', '', '', '']
  const sign = (s: string) => s.replace('#', '♯').replace('b', '♭')
  const rest = match[3] ?? ''
  const minor = rest.startsWith('m') && !rest.startsWith('maj')
  return [
    match[1] ?? '',
    sign(match[2] ?? ''),
    minor ? 'm' : '',
    // In the quality only an accidental before a degree is one ("m7b5").
    (minor ? rest.slice(1) : rest).replace(/[b#](?=\d)/g, sign),
    match[4] ? `/${sign(match[4])}` : '',
  ]
}

function prepare(notes: GuitarRollProps['notes'], chords: GuitarRollProps['chords']): Prepared {
  const anchor = new Float64Array(notes.length)
  const gap = new Float64Array(notes.length)
  const shapes: Prepared['shapes'] = []
  let index = 0
  for (const group of noteGroups(notes)) {
    let top = Number.POSITIVE_INFINITY
    let bottom = 0
    for (const note of group.notes) {
      anchor[index++] = group.t0
      top = Math.min(top, note.string)
      bottom = Math.max(bottom, note.string)
    }
    if (bottom > top) shapes.push({ t: group.t0, top, bottom })
  }
  const nextOn = new Map<number, number>()
  for (let i = notes.length - 1; i >= 0; i--) {
    const string = (notes[i] as FretNote).string
    gap[i] = (nextOn.get(string) ?? Number.POSITIVE_INFINITY) - (anchor[i] as number)
    nextOn.set(string, anchor[i] as number)
  }
  return {
    notes,
    anchor,
    gap,
    shapes,
    longest: notes.reduce((max, n) => Math.max(max, n.t1 - n.t0), 0),
    chords: chords.map((c) => ({ t: c.t, parts: chordParts(c.name), low: c.low, widths: [] })),
  }
}

// The fonts and text widths for a theme, re-measured when it changes (and the chords' with them).
function styleFor(context: CanvasRenderingContext2D, frame: Frame, px: number): Style {
  const { theme } = frame.props
  const key = `${theme.family}|${theme.tabPx}|${theme.barNumberPx}|${px}`
  const chords = frame.prepared.chords
  if (frame.style?.key === key && (chords.length === 0 || chords[0]?.widths.length)) {
    return frame.style
  }
  const chordPx = Math.round(theme.tabPx * 0.75)
  const parts = PART_STYLES.map((p) => `${p.weight} ${chordPx * p.size}px ${theme.family}`)
  const digit = `600 ${px}px ${theme.family}`
  context.font = digit
  const digitWidths = FRET_LABELS.map((label) => context.measureText(label).width)
  for (const chord of chords) {
    chord.widths = chord.parts.map((text, i) => {
      context.font = parts[i] as string
      return text ? context.measureText(text).width : 0
    })
  }
  const markPx = Math.max(10, px * 0.42)
  frame.style = {
    key,
    digit,
    digitWidths,
    number: `500 ${theme.barNumberPx}px ${theme.family}`,
    mark: `600 ${markPx}px ${theme.family}`,
    query: `700 ${markPx}px ${theme.family}`,
    parts,
    chordPx,
  }
  return frame.style
}

// First index whose time is at or after `t`, for each kind of list the frame searches.
function lowerTimes(values: ArrayLike<number>, t: number): number {
  let lo = 0
  let hi = values.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((values[mid] as number) < t) lo = mid + 1
    else hi = mid
  }
  return lo
}
function lowerItems(items: readonly { t: number }[], t: number): number {
  let lo = 0
  let hi = items.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((items[mid] as { t: number }).t < t) lo = mid + 1
    else hi = mid
  }
  return lo
}
function lowerOnsets(notes: readonly FretNote[], t: number): number {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((notes[mid] as FretNote).t0 < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

function windowStart(props: GuitarRollProps, now: number) {
  return props.page ? props.page(now) : now
}

function setStretch(out: Stretch[], i: number, a: number, b: number, off: number, clip: number) {
  const stretch = out[i] as Stretch
  stretch.a = a
  stretch.b = b
  stretch.off = off
  stretch.clip = clip
}

/** The stretches of the timeline from `start` to `end` as the lanes show them, written into `out`
 * (its length caps them); returns how many. Inside a loop the view runs on past the loop's end into
 * its next pass, each pass clipped at the end, so the wrap never blanks or jumps. */
export function rollStretches(
  start: number,
  end: number,
  loop: { t0: number; t1: number } | null,
  out: Stretch[],
): number {
  if (!loop || start < loop.t0 || start >= loop.t1) {
    setStretch(out, 0, start, end, 0, Number.POSITIVE_INFINITY)
    return 1
  }
  const length = loop.t1 - loop.t0
  let count = 0
  let a = start
  let off = 0
  while (a < end && count < out.length) {
    const b = Math.min(end, loop.t1 + off)
    setStretch(out, count++, a - off, b - off, off, loop.t1)
    a = b
    off += length
  }
  return count
}

function lanesFor(frame: Frame, w: number, h: number, ratio: number) {
  const { strings, theme } = frame.props
  const key = `${w}x${h}@${ratio}|${strings}|${theme.staff}|${theme.tabPx}`
  if (frame.lanes && frame.lanesKey === key) return frame.lanes
  const canvas = frame.lanes ?? document.createElement('canvas')
  canvas.width = Math.round(w * ratio)
  canvas.height = Math.round(h * ratio)
  const context = canvas.getContext('2d')
  if (context) {
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, w, h)
    const rows = stringRows(h, strings, theme.tabPx)
    context.fillStyle = theme.staff
    for (let string = 1; string <= strings; string++) {
      context.fillRect(HIT, Math.round(rowAt(rows, string)) - 0.5, w - HIT, 1)
    }
  }
  frame.lanes = canvas
  frame.lanesKey = key
  return canvas
}

function draw(
  context: CanvasRenderingContext2D,
  w: number,
  h: number,
  ratio: number,
  frame: Frame,
  now: number,
) {
  const { props, prepared } = frame
  const { theme, strings, span, bars, beats, loop, showUncertainty, markers } = props
  const { notes, anchor, gap, shapes, chords, longest } = prepared
  const rows = stringRows(h, strings, theme.tabPx)
  // Fret digits at the reading size, smaller only when the lanes are (a phone in landscape).
  const px = Math.min(theme.tabPx, rows.lane * 0.78)
  const style = styleFor(context, frame, px)
  const top = rows.top
  const height = rows.lane * strings
  const start = windowStart(props, now)
  const pps = (w - HIT - 8) / span
  const stretches = frame.stretches
  const count = rollStretches(start, start + span, loop, stretches)
  context.clearRect(0, 0, w, h)
  context.drawImage(lanesFor(frame, w, h, ratio), 0, 0, w, h)

  // The loop band, and the seam where its next pass starts.
  if (loop) {
    for (let s = 0; s < count; s++) {
      const { a, b, off } = stretches[s] as Stretch
      const from = HIT + (Math.max(a, loop.t0) + off - start) * pps
      const to = HIT + (Math.min(b, loop.t1) + off - start) * pps
      if (to > from) {
        context.fillStyle = theme.loopFill
        context.fillRect(from, top - 4, to - from, height + 8)
      }
      if (off > 0) {
        context.fillStyle = theme.loopEdge
        context.fillRect(HIT + (a + off - start) * pps - 1, top - 4, 2, height + 8)
      }
    }
  }

  // Beat and bar lines, bar numbers under the lanes, chord names and "!" over them.
  // Chord names over bar numbers over the lanes, as on the tab.
  const chordBase = top - theme.barNumberPx - 10
  context.textBaseline = 'alphabetic'
  for (let s = 0; s < count; s++) {
    const { a, b, off } = stretches[s] as Stretch
    const shift = HIT + (off - start) * pps
    context.fillStyle = theme.staff
    context.globalAlpha = 0.35
    for (let i = lowerTimes(beats, a); i < beats.length && (beats[i] as number) < b; i++) {
      context.fillRect(Math.round(shift + (beats[i] as number) * pps), top, 1, height)
    }
    context.globalAlpha = 1
    context.font = style.number
    context.textAlign = 'left'
    for (let i = lowerItems(bars, a); i < bars.length; i++) {
      const bar = bars[i] as { t: number; label: string }
      if (bar.t >= b) break
      const at = Math.round(shift + bar.t * pps)
      context.fillStyle = theme.staff
      context.fillRect(at - 1, top, 2, height)
      context.fillStyle = theme.medium
      context.fillText(bar.label, at + 5, top - 5)
    }
    for (let i = lowerItems(chords, a); i < chords.length; i++) {
      const chord = chords[i] as Chord
      if (chord.t >= b) break
      let cx = shift + chord.t * pps
      context.fillStyle = theme.ink
      for (let p = 0; p < PART_STYLES.length; p++) {
        const text = chord.parts[p] as string
        if (!text) continue
        context.font = style.parts[p] as string
        context.fillText(text, cx, chordBase + (PART_STYLES[p]?.rise ?? 0) * style.chordPx)
        cx += chord.widths[p] ?? 0
      }
      if (chord.low && showUncertainty) {
        context.fillStyle = theme.low
        context.font = style.query
        context.fillText('?', cx + 1, chordBase - style.chordPx * 0.38)
      }
    }
    context.font = style.parts[0] as string
    context.textAlign = 'center'
    context.fillStyle = theme.ink
    for (let i = lowerItems(markers, a); i < markers.length; i++) {
      const marker = markers[i] as { t: number; label: string }
      if (marker.t >= b) break
      context.fillText(marker.label, shift + marker.t * pps + style.chordPx * 0.3, chordBase)
    }
  }

  // Tails, the rule through each strum, then the heads over them.
  const headH = Math.min(rows.lane * 0.84, px * 1.3)
  const tailH = Math.max(4, rows.lane * 0.18)
  context.fillStyle = theme.accent
  for (let s = 0; s < count; s++) {
    const { a, b, off, clip } = stretches[s] as Stretch
    const shift = HIT + (off - start) * pps
    for (let i = lowerOnsets(notes, a - longest); i < notes.length; i++) {
      const note = notes[i] as FretNote
      if (note.t0 >= b) break
      if (note.t1 <= a) continue
      const x0 = Math.max(HIT, shift + (anchor[i] as number) * pps)
      const x1 = shift + Math.min(note.t1, clip) * pps
      if (x1 <= x0) continue
      context.beginPath()
      context.roundRect(x0, rowAt(rows, note.string) - tailH / 2, x1 - x0, tailH, tailH / 2)
      context.fill()
    }
  }
  context.fillStyle = theme.ink
  context.globalAlpha = 0.6
  for (let s = 0; s < count; s++) {
    const { a, b, off } = stretches[s] as Stretch
    const shift = HIT + (off - start) * pps
    for (let i = lowerItems(shapes, a); i < shapes.length; i++) {
      const shape = shapes[i] as Prepared['shapes'][number]
      if (shape.t >= b) break
      const y0 = rowAt(rows, shape.top)
      context.fillRect(shift + shape.t * pps + headH / 2 - 1, y0, 2, rowAt(rows, shape.bottom) - y0)
    }
  }
  context.globalAlpha = 1
  const markPx = Math.max(10, px * 0.42)
  context.textAlign = 'center'
  for (let s = 0; s < count; s++) {
    const { a, b, off } = stretches[s] as Stretch
    const shift = HIT + (off - start) * pps
    for (let i = lowerTimes(anchor, a); i < notes.length && (anchor[i] as number) < b; i++) {
      const note = notes[i] as FretNote
      const digits = style.digitWidths[note.fret] ?? style.chordPx
      const hw = Math.min(
        Math.max(headH * 0.95, digits + px * 0.55),
        Math.max(digits + 6, (gap[i] as number) * pps - 3),
      )
      const left = shift + (anchor[i] as number) * pps
      const y = rowAt(rows, note.string)
      const unsure = showUncertainty && note.band !== 'high'
      const ink = unsure ? (note.band === 'low' ? theme.low : theme.medium) : theme.ink
      context.beginPath()
      context.roundRect(left, y - headH / 2, hw, headH, Math.min(headH * 0.32, hw / 2))
      context.fillStyle = theme.paper
      context.fill()
      // Sure notes are tinted with the instrument's hue; unsure ones stay paper, like a draft.
      if (!unsure) {
        context.globalAlpha = 0.3
        context.fillStyle = theme.accent
        context.fill()
        context.globalAlpha = 1
      }
      if (unsure) context.setLineDash(DASH)
      context.lineWidth = unsure ? 2 : 1.5
      context.strokeStyle = ink
      context.stroke()
      if (unsure) context.setLineDash(SOLID)
      context.font = style.digit
      context.textBaseline = 'middle'
      context.fillStyle = ink
      context.fillText(FRET_LABELS[note.fret] ?? '', left + hw / 2, y + px * 0.04)
      context.textBaseline = 'alphabetic'
      if (unsure && note.band === 'low') {
        context.font = style.query
        context.fillStyle = theme.low
        context.fillText('?', left + hw + markPx * 0.4, y - headH / 2 + markPx * 0.5)
      }
      if (note.octave) {
        context.font = style.mark
        context.fillStyle = theme.ink
        context.fillText(note.octave, left + hw / 2, y - headH / 2 - 3)
      }
    }
  }
  context.textAlign = 'start'

  // The hit line; with reduced motion the playhead crosses the page instead.
  context.fillStyle = theme.playhead
  const playhead = props.page ? HIT + (now - start) * pps - 1 : 0
  context.fillRect(playhead, top - 6, 2, height + 12)
}

// Uncertain notes by band, for the page's tests (the canvas is hidden from the accessibility tree).
const countBand = (notes: readonly FretNote[], band: FretNote['band']) =>
  notes.reduce((n, note) => n + (note.band === band ? 1 : 0), 0)

const DASH = [4, 3]
const SOLID: number[] = []

export function GuitarRoll(props: GuitarRollProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<Frame | null>(null)
  frame.current ??= {
    props,
    prepared: prepare(props.notes, props.chords),
    style: null,
    stretches: Array.from({ length: 4 }, () => ({ a: 0, b: 0, off: 0, clip: 0 })),
    lanes: null,
    lanesKey: '',
  }
  frame.current.props = props
  const { notes, chords } = props
  useEffect(() => {
    if (frame.current) frame.current.prepared = prepare(notes, chords)
  }, [notes, chords])

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    let size = { w: 0, h: 0, ratio: 1 }
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (!box) return
      const ratio = window.devicePixelRatio || 1
      size = { w: box.width, h: box.height, ratio }
      element.width = Math.round(box.width * ratio)
      element.height = Math.round(box.height * ratio)
    })
    observer.observe(element)
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const current = frame.current
      if (size.w === 0 || size.h === 0 || !current) return
      context.setTransform(size.ratio, 0, 0, size.ratio, 0, 0)
      draw(context, size.w, size.h, size.ratio, current, current.props.clock())
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvas}
      aria-hidden
      data-slot="guitar-roll"
      data-medium={props.showUncertainty ? countBand(props.notes, 'medium') : 0}
      data-low={props.showUncertainty ? countBand(props.notes, 'low') : 0}
      className={props.className}
      onClick={(event) => {
        const current = frame.current
        if (!current?.props.onTimeActivate) return
        const { onTimeActivate, clock, span } = current.props
        const box = event.currentTarget.getBoundingClientRect()
        const start = windowStart(current.props, clock())
        onTimeActivate(start + ((event.clientX - box.left - HIT) / (box.width - HIT - 8)) * span)
      }}
    />
  )
}
