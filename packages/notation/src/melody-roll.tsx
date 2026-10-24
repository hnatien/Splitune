import { useEffect, useRef } from 'react'
import { chordParts, PART_STYLES, rollStretches, type Stretch } from './guitar-roll.tsx'
import {
  degreeName,
  followWindow,
  lowerOnset,
  type MelodyRollNote,
  type MelodyRollPhrase,
  NOW_SHARE,
  type PitchWindow,
  phraseIndexAt,
  wholeWindow,
} from './melody.ts'

// Vocal Melody roll (step 18c, mockup docs/implementation/18c): the sung notes as a horizontal
// piano-roll, time left to right onto a now line a fifth of the way in (what was just sung stays
// in view), pitch upwards against a rail that shows the key: out-of-key rows faintly shaded, the
// tonic ruled, the pitch being sung ringed. Notes carry their name or scale degree when they fit;
// consecutive notes of a phrase are joined, so the melody's shape reads at a glance. Phrase
// markers run along the top (a tap loops one) with a breath mark where each ends; chord names over
// bar numbers sit under them. The pitch window follows what's on screen (an octave at least,
// eased) or holds the whole song. Confidence as everywhere (26 §5): sure notes tinted with the
// vocal hue and outlined in ink, unsure ones paper with the dashed outline, low ones "?" for a
// name. Drawn from the clock every frame (12 §3); a loop's next pass is drawn past its end; with
// reduced motion the roll holds still for a page and only the playhead moves.

export interface MelodyRollTheme {
  family: string
  /** Note names at most this big (the reading size). */
  readPx: number
  barNumberPx: number
  paper: string
  ink: string
  staff: string
  playhead: string
  loopFill: string
  loopEdge: string
  barCurrent: string
  medium: string
  low: string
  /** --melody-vocals: the note tint and the ring on the rail. */
  accent: string
}

export interface MelodyRollProps {
  /** By onset. */
  notes: readonly MelodyRollNote[]
  /** By start; every note sits inside one. */
  phrases: readonly MelodyRollPhrase[]
  /** Playback position in seconds. */
  clock: () => number
  /** Seconds from the now line to the right edge. */
  span: number
  bars: readonly { t: number; label: string }[]
  beats: readonly number[]
  chords: readonly { t: number; name: string; low: boolean }[]
  loop: { t0: number; t1: number } | null
  /** Reduced motion: the start of the page that holds a time. */
  page?: ((t: number) => number) | undefined
  /** The song's key: its seven pitch classes, the tonic first. */
  scale: readonly number[]
  /** Each pitch class's name in the key (E♭, not D♯). */
  pitchNames: readonly string[]
  labels: 'names' | 'degrees' | 'off'
  window: 'follow' | 'whole'
  showUncertainty: boolean
  theme: MelodyRollTheme
  /** A click on the notes: the time under the pointer. */
  onTimeActivate?: (t: number) => void
  /** A click on a phrase marker. */
  onPhraseActivate?: (index: number) => void
  className?: string
}

// The pitch window eases to where it's going; a seek jumps.
const EASE_S = 0.12
const SEEK_S = 0.25
// What the window follows: half a view back to a view and a quarter ahead of the now line.
const LOOK = { back: 0.5, ahead: 1.25 }
const DASH = [4, 3]
const SOLID: number[] = []

interface Chord {
  t: number
  parts: string[]
  low: boolean
  widths: number[]
}

interface Prepared {
  notes: readonly MelodyRollNote[]
  longest: number
  /** Per note: its phrase. */
  phraseOf: Int32Array
  /** Per phrase: its last note's pitch, where the breath mark sits. */
  lastPitch: Float64Array
  whole: PitchWindow
  chords: Chord[]
}

interface Style {
  key: string
  labelPx: number
  railPx: number
  railW: number
  bandH: number
  laneH: number
  chordPx: number
  number: string
  marker: string
  markerBold: string
  label: string
  rail: string
  railBold: string
  breath: string
  parts: string[]
  /** Per MIDI pitch: the note's label and the rail's, and the note label's width. */
  noteText: string[]
  railText: string[]
  noteWidth: Float64Array
}

interface Geometry {
  w: number
  top: number
  bottom: number
  rowH: number
  high: number
  left: number
  pps: number
  now: number
}

interface Frame {
  props: MelodyRollProps
  prepared: Prepared
  style: Style | null
  past: Stretch
  ahead: Stretch[]
  view: PitchWindow
  last: number
  lastAt: number
  /** Where the roll was last drawn, for clicks. */
  left: number
  pps: number
  railW: number
  bandH: number
  canvas: HTMLCanvasElement | null
}

function prepare(
  notes: MelodyRollProps['notes'],
  phrases: MelodyRollProps['phrases'],
  chords: MelodyRollProps['chords'],
): Prepared {
  const phraseOf = new Int32Array(notes.length)
  const lastPitch = new Float64Array(phrases.length)
  notes.forEach((note, i) => {
    const p = Math.max(0, phraseIndexAt(phrases, note.t0))
    phraseOf[i] = p
    lastPitch[p] = note.pitch
  })
  return {
    notes,
    longest: notes.reduce((max, n) => Math.max(max, n.t1 - n.t0), 0),
    phraseOf,
    lastPitch,
    whole: wholeWindow(notes),
    chords: chords.map((c) => ({ t: c.t, parts: chordParts(c.name), low: c.low, widths: [] })),
  }
}

// Fonts, label texts and widths for a theme and a row height, re-measured when they change.
function styleFor(context: CanvasRenderingContext2D, frame: Frame, rowH: number): Style {
  const { theme, labels, pitchNames, scale } = frame.props
  const labelPx = Math.round(Math.max(11, Math.min(theme.readPx, rowH * 0.62)))
  const key = `${theme.family}|${theme.readPx}|${theme.barNumberPx}|${labelPx}|${labels}|${pitchNames.join()}|${scale.join()}`
  const chords = frame.prepared.chords
  if (frame.style?.key === key && (chords.length === 0 || chords[0]?.widths.length)) {
    return frame.style
  }
  const font = (weight: number, px: number) => `${weight} ${px}px ${theme.family}`
  const tonic = scale[0] ?? 0
  const label = font(600, labelPx)
  const noteText: string[] = []
  const railText: string[] = []
  const noteWidth = new Float64Array(128)
  context.font = label
  for (let pitch = 0; pitch < 128; pitch++) {
    const name = pitchNames[pitch % 12] ?? ''
    const degree = degreeName(pitch, tonic)
    const text = labels === 'names' ? name : labels === 'degrees' ? degree : ''
    noteText.push(text)
    railText.push(labels === 'degrees' ? degree : `${name}${Math.floor(pitch / 12) - 1}`)
    noteWidth[pitch] = text ? context.measureText(text).width : 0
  }
  const chordPx = Math.round(theme.readPx * 0.7)
  const parts = PART_STYLES.map((p) => font(p.weight, chordPx * p.size))
  for (const chord of chords) {
    chord.widths = chord.parts.map((text, i) => {
      context.font = parts[i] as string
      return text ? context.measureText(text).width : 0
    })
  }
  const railPx = Math.min(labelPx, 16)
  const railBold = font(700, railPx)
  context.font = railBold
  frame.style = {
    key,
    labelPx,
    railPx,
    railW: Math.ceil(context.measureText('G♭5').width + 24),
    bandH: Math.round(theme.barNumberPx * 2.3),
    laneH: Math.round(chordPx * 1.5),
    chordPx,
    number: font(500, theme.barNumberPx),
    marker: font(600, theme.barNumberPx),
    markerBold: font(700, theme.barNumberPx),
    label,
    rail: font(500, railPx),
    railBold,
    breath: font(700, Math.round(labelPx * 1.2)),
    parts,
    noteText,
    railText,
    noteWidth,
  }
  return frame.style
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
function lowerTimes(values: readonly number[], t: number): number {
  let lo = 0
  let hi = values.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((values[mid] as number) < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** The pitch sung at `t` (a note that isn't low confidence), or -1. */
function sungAt(notes: readonly MelodyRollNote[], t: number, longest: number): number {
  for (let i = lowerOnset(notes, t + 1e-6) - 1; i >= 0; i--) {
    const note = notes[i] as MelodyRollNote
    if (note.t0 < t - longest) break
    if (note.t1 > t && note.band !== 'low') return note.pitch
  }
  return -1
}

// One stretch of the timeline: the loop band, beat and bar lines, chord names and bar numbers,
// the phrase's joins, the notes and the breath marks.
function drawStretch(
  context: CanvasRenderingContext2D,
  frame: Frame,
  style: Style,
  stretch: Stretch,
  g: Geometry,
  isPast: boolean,
) {
  const { props, prepared } = frame
  const { theme, loop, bars, beats, phrases, showUncertainty } = props
  const { notes, longest, phraseOf, lastPitch, chords } = prepared
  const { a, b, off, clip } = stretch
  const shift = style.railW + (off - g.left) * g.pps
  const X = (t: number) => shift + t * g.pps
  const Y = (pitch: number) => g.top + (g.high - pitch) * g.rowH
  const height = g.bottom - g.top

  context.save()
  context.beginPath()
  context.rect(
    Math.max(style.railW, X(a)),
    0,
    Math.max(0, X(b) - Math.max(style.railW, X(a))),
    g.bottom,
  )
  context.clip()

  if (loop) {
    const from = X(Math.max(a, loop.t0))
    const to = X(Math.min(b, loop.t1))
    if (to > from) {
      context.fillStyle = theme.loopFill
      context.fillRect(from, g.top, to - from, height)
    }
    if (off > 0) {
      context.fillStyle = theme.loopEdge
      context.fillRect(X(a) - 1, g.top, 2, height)
    }
  }

  context.fillStyle = theme.staff
  context.globalAlpha = 0.35
  for (let i = lowerTimes(beats, a); i < beats.length && (beats[i] as number) < b; i++) {
    context.fillRect(Math.round(X(beats[i] as number)), g.top, 1, height)
  }
  context.globalAlpha = 1
  const laneY = style.bandH + style.laneH / 2
  context.textBaseline = 'middle'
  for (let i = lowerItems(bars, a); i < bars.length; i++) {
    const bar = bars[i] as { t: number; label: string }
    if (bar.t >= b) break
    const x = Math.round(X(bar.t))
    context.fillStyle = theme.staff
    context.fillRect(x - 1, g.top, 2, height)
    context.font = style.number
    context.fillStyle = theme.medium
    context.fillText(bar.label, x + 5, laneY)
  }
  // Chord names after the bar number when they start on the bar line.
  const numberRoom = style.chordPx * 1.6
  for (let i = lowerItems(chords, a); i < chords.length; i++) {
    const chord = chords[i] as Chord
    if (chord.t >= b) break
    const onBar = bars[lowerItems(bars, chord.t - 0.05)]
    let cx = X(chord.t) + 5 + (onBar && Math.abs(onBar.t - chord.t) < 0.05 ? numberRoom : 0)
    context.fillStyle = theme.ink
    for (let p = 0; p < PART_STYLES.length; p++) {
      const text = chord.parts[p] as string
      if (!text) continue
      context.font = style.parts[p] as string
      context.fillText(text, cx, laneY + (PART_STYLES[p]?.rise ?? 0) * style.chordPx)
      cx += chord.widths[p] ?? 0
    }
    if (chord.low && showUncertainty) {
      context.fillStyle = theme.low
      context.font = style.label
      context.fillText('?', cx + 1, laneY - style.chordPx * 0.3)
    }
  }
  context.restore()

  context.save()
  context.beginPath()
  context.rect(style.railW, g.top, g.w - style.railW, height)
  context.clip()
  const first = lowerOnset(notes, a - longest)
  // Joins between consecutive notes of a phrase (low-confidence ones skipped).
  context.strokeStyle = theme.staff
  context.lineWidth = 1.5
  context.beginPath()
  let previous = -1
  for (let i = Math.max(0, first - 1); i < notes.length; i++) {
    const note = notes[i] as MelodyRollNote
    if (note.t0 >= b) break
    if (note.band === 'low') continue
    const prev = previous >= 0 ? (notes[previous] as MelodyRollNote) : null
    if (prev && phraseOf[previous] === phraseOf[i] && note.t0 <= clip) {
      context.moveTo(X(Math.min(prev.t1, note.t0)), Y(prev.pitch) + g.rowH / 2)
      context.lineTo(X(note.t0), Y(note.pitch) + g.rowH / 2)
    }
    previous = i
  }
  context.stroke()

  const headH = Math.max(4, g.rowH - 3)
  const radius = Math.min(8, headH / 2.5)
  context.textBaseline = 'middle'
  for (let i = first; i < notes.length; i++) {
    const note = notes[i] as MelodyRollNote
    if (note.t0 >= b) break
    if (note.t1 <= a || note.t0 >= clip) continue
    const x0 = X(note.t0)
    const x1 = X(Math.min(note.t1, clip))
    const width = Math.max(4, x1 - x0)
    const y = Y(note.pitch) + 1.5
    const unsure = showUncertainty && note.band !== 'high'
    const gone = isPast && note.t1 <= g.now
    const sounding = isPast && note.t0 <= g.now && note.t1 > g.now
    const ink = unsure
      ? note.band === 'low'
        ? theme.low
        : theme.medium
      : gone
        ? theme.medium
        : theme.ink
    context.beginPath()
    context.roundRect(x0, y, width, headH, radius)
    context.fillStyle = theme.paper
    context.fill()
    if (!unsure && !gone) {
      context.globalAlpha = 0.3
      context.fillStyle = theme.accent
      context.fill()
      context.globalAlpha = 1
    }
    if (unsure) context.setLineDash(DASH)
    context.lineWidth = sounding ? 3 : unsure ? 2 : 1.5
    context.strokeStyle = ink
    context.stroke()
    if (unsure) context.setLineDash(SOLID)
    const text = unsure && note.band === 'low' ? '?' : (style.noteText[note.pitch] ?? '')
    const textWidth = text === '?' ? style.labelPx * 0.6 : (style.noteWidth[note.pitch] ?? 0)
    if (text && headH >= 11 && width >= textWidth + 10) {
      context.font = style.label
      context.fillStyle = ink
      context.fillText(text, x0 + 6, y + headH / 2 + 0.5)
    }
  }

  context.font = style.breath
  context.fillStyle = theme.medium
  context.textBaseline = 'alphabetic'
  for (let i = Math.max(0, phraseIndexAt(phrases, a - 1)); i < phrases.length; i++) {
    const phrase = phrases[i] as MelodyRollPhrase
    if (phrase.t0 >= b) break
    if (phrase.t1 < a || phrase.t1 >= b || phrase.t1 > clip) continue
    context.fillText('’', X(phrase.t1) + 3, Y(lastPitch[i] ?? 0) + style.labelPx * 0.3)
  }
  context.restore()
}

function draw(
  context: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: Frame,
  now: number,
  wall: number,
) {
  const { props, prepared } = frame
  const { theme, span, loop, phrases, scale } = props
  const { notes, longest } = prepared

  // The pitch window: where it's going, and how far it gets this frame.
  const target =
    props.window === 'whole'
      ? prepared.whole
      : followWindow(
          notes,
          now - LOOK.back * span,
          now + LOOK.ahead * span,
          longest,
          frame.view.high > 0 ? frame.view : prepared.whole,
        )
  const jumped = !Number.isFinite(frame.last) || Math.abs(now - frame.last) > SEEK_S
  const k =
    props.page || jumped ? 1 : 1 - Math.exp(-Math.max(0, wall - frame.lastAt) / 1000 / EASE_S)
  frame.view.low += (target.low - frame.view.low) * k
  frame.view.high += (target.high - frame.view.high) * k
  frame.last = now
  frame.lastAt = wall
  const { low, high } = frame.view

  const firstStyle = frame.style ?? styleFor(context, frame, 24)
  const rowsTop = firstStyle.bandH + firstStyle.laneH
  const style = styleFor(context, frame, (h - 2 - rowsTop) / (high - low + 1))
  const top = style.bandH + style.laneH
  const bottom = h - 2
  const rowH = (bottom - top) / (high - low + 1)
  const total = span / (1 - NOW_SHARE)
  const pps = (w - style.railW) / total
  const left = (props.page ? props.page(now) : now) - NOW_SHARE * total
  frame.left = left
  frame.pps = pps
  frame.railW = style.railW
  frame.bandH = style.bandH
  const g: Geometry = { w, top, bottom, rowH, high, left, pps, now }
  const Y = (pitch: number) => top + (high - pitch) * rowH

  context.clearRect(0, 0, w, h)
  context.fillStyle = theme.paper
  context.fillRect(0, 0, w, h)

  // Rows: out-of-key ones faintly shaded, the tonic ruled through its middle.
  const tonic = scale[0] ?? 0
  context.save()
  context.beginPath()
  context.rect(style.railW, top, w - style.railW, bottom - top)
  context.clip()
  for (let pitch = Math.floor(low) - 1; pitch <= Math.ceil(high) + 1; pitch++) {
    const y = Y(pitch)
    if (!scale.includes(((pitch % 12) + 12) % 12)) {
      context.globalAlpha = 0.045
      context.fillStyle = theme.ink
      context.fillRect(style.railW, y, w - style.railW, rowH)
      context.globalAlpha = 1
    }
    if ((((pitch - tonic) % 12) + 12) % 12 === 0) {
      context.fillStyle = theme.staff
      context.fillRect(style.railW, Math.round(y + rowH / 2), w - style.railW, 1)
    }
  }
  context.restore()

  // The past as it was, then from the now line on (past a loop's end, its next pass).
  const past = frame.past
  past.a = left
  past.b = now
  past.off = 0
  past.clip = Number.POSITIVE_INFINITY
  const count = rollStretches(now, left + total, loop, frame.ahead)
  drawStretch(context, frame, style, past, g, true)
  for (let s = 0; s < count; s++) {
    drawStretch(context, frame, style, frame.ahead[s] as Stretch, g, false)
  }

  // Phrase markers along the top, the current one ruled, a looped one in the loop's colours.
  const current = phraseIndexAt(phrases, now)
  context.textBaseline = 'middle'
  for (let s = -1; s < count; s++) {
    const { a, b, off } = s < 0 ? past : (frame.ahead[s] as Stretch)
    const shift = style.railW + (off - left) * pps
    for (let i = Math.max(0, phraseIndexAt(phrases, a)); i < phrases.length; i++) {
      const phrase = phrases[i] as MelodyRollPhrase
      if (phrase.t0 >= b) break
      if (phrase.t1 <= a) continue
      const x0 = Math.max(style.railW + 2, shift + Math.max(phrase.t0, a) * pps)
      const x1 = Math.min(w - 2, shift + Math.min(phrase.t1, b) * pps)
      if (x1 - x0 < 8) continue
      const looped = loop !== null && phrase.t0 >= loop.t0 - 1e-3 && phrase.t1 <= loop.t1 + 1e-3
      const here = i === current && now <= phrase.t1 + 0.3 && off === 0
      context.beginPath()
      context.roundRect(x0, 5, x1 - x0, style.bandH - 10, 8)
      context.fillStyle = looped ? theme.loopFill : here ? theme.barCurrent : theme.paper
      context.fill()
      context.lineWidth = looped || here ? 2 : 1
      context.strokeStyle = looped ? theme.loopEdge : here ? theme.ink : theme.staff
      context.stroke()
      context.save()
      context.beginPath()
      context.rect(x0, 0, Math.max(0, x1 - x0 - 6), style.bandH)
      context.clip()
      context.font = here ? style.markerBold : style.marker
      context.fillStyle = theme.ink
      context.fillText(phrase.label, x0 + 10, style.bandH / 2)
      context.restore()
    }
  }
  context.fillStyle = theme.staff
  context.fillRect(0, style.bandH, w, 1)

  // The rail: the key's pitches, the one being sung ringed. Short rows name every other degree.
  const sung = sungAt(notes, now, longest)
  context.fillStyle = theme.paper
  context.fillRect(0, top, style.railW, h - top)
  context.fillStyle = theme.staff
  context.fillRect(style.railW, top, 1, h - top)
  for (let pitch = Math.ceil(low); pitch <= Math.floor(high); pitch++) {
    const degree = scale.indexOf(pitch % 12)
    if (degree < 0 || (rowH < 14 && degree % 2 === 1 && pitch !== sung)) continue
    const y = Y(pitch) + rowH / 2
    if (pitch === sung) {
      const ring = Math.min(28, Math.max(rowH, style.railPx + 6))
      context.beginPath()
      context.roundRect(4, y - ring / 2, style.railW - 10, ring, 6)
      context.lineWidth = 2
      context.strokeStyle = theme.accent
      context.stroke()
    }
    const strong = degree === 0 || pitch === sung
    context.font = strong ? style.railBold : style.rail
    context.fillStyle = strong ? theme.ink : theme.medium
    context.fillText(style.railText[pitch] ?? '', 10, y + 0.5)
  }
  context.textBaseline = 'alphabetic'

  // The now line (with reduced motion, the playhead crossing the page).
  context.fillStyle = theme.playhead
  context.fillRect(
    Math.round(style.railW + (now - left) * pps) - 1,
    style.bandH,
    2,
    h - style.bandH,
  )

  // What the page's tests read (the canvas is hidden from the accessibility tree).
  const canvas = frame.canvas
  if (canvas) {
    const shown = `${Math.round(low)}-${Math.round(high)}`
    if (canvas.getAttribute('data-window') !== shown) canvas.setAttribute('data-window', shown)
    const sungText = sung < 0 ? '' : String(sung)
    if (canvas.getAttribute('data-sung') !== sungText) canvas.setAttribute('data-sung', sungText)
  }
}

const countBand = (notes: readonly MelodyRollNote[], band: MelodyRollNote['band']) =>
  notes.reduce((n, note) => n + (note.band === band ? 1 : 0), 0)

export function MelodyRoll(props: MelodyRollProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<Frame | null>(null)
  frame.current ??= {
    props,
    prepared: prepare(props.notes, props.phrases, props.chords),
    style: null,
    past: { a: 0, b: 0, off: 0, clip: 0 },
    ahead: Array.from({ length: 4 }, () => ({ a: 0, b: 0, off: 0, clip: 0 })),
    view: { low: 0, high: 0 },
    last: Number.NaN,
    lastAt: 0,
    left: 0,
    pps: 1,
    railW: 0,
    bandH: 0,
    canvas: null,
  }
  frame.current.props = props
  const { notes, phrases, chords } = props
  useEffect(() => {
    if (!frame.current) return
    frame.current.prepared = prepare(notes, phrases, chords)
    frame.current.style = null
  }, [notes, phrases, chords])

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context || !frame.current) return
    frame.current.canvas = element
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
    const tick = (wall: number) => {
      raf = requestAnimationFrame(tick)
      const current = frame.current
      if (size.w === 0 || size.h === 0 || !current) return
      context.setTransform(size.ratio, 0, 0, size.ratio, 0, 0)
      draw(context, size.w, size.h, current, current.props.clock(), wall)
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
      data-slot="melody-roll"
      data-phrases={props.phrases.length}
      data-labels={props.labels}
      data-medium={props.showUncertainty ? countBand(props.notes, 'medium') : 0}
      data-low={props.showUncertainty ? countBand(props.notes, 'low') : 0}
      className={props.className}
      onClick={(event) => {
        const current = frame.current
        if (!current) return
        const { onTimeActivate, onPhraseActivate, phrases: all } = current.props
        const box = event.currentTarget.getBoundingClientRect()
        const x = event.clientX - box.left
        const y = event.clientY - box.top
        if (x < current.railW) return
        const t = current.left + (x - current.railW) / current.pps
        if (y <= current.bandH) {
          const index = phraseIndexAt(all, t)
          const phrase = all[index]
          if (phrase && t <= phrase.t1) onPhraseActivate?.(index)
          return
        }
        onTimeActivate?.(t)
      }}
    />
  )
}
