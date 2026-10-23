import { useEffect, useRef } from 'react'
import { keyboardKeys } from './keyboard-diagram.tsx'

// Falling-notes roll (21 V4; ux/music-display-ui: keep the roll aligned to the keys). Notes fall
// towards the now line at the bottom edge, where a KeyboardDiagram with the same `from`/`to` sits,
// so each note lands on its key. Hands differ in lightness, shape and outline and carry L or R
// (26 §5: never colour alone): the left hand's notes are square with a heavier ink outline, the
// right hand's rounded with a staff outline; the outline, not the fill, is what meets 3:1 on the
// paper and the loop band. Uncertain notes get the score's dashed outline, low ones a "?" too. Drawn on a
// canvas from the clock every frame (the display never owns the clock, 12 §3); with reduced
// motion the window holds still for a page and only the playhead moves.

export type RollBand = 'high' | 'medium' | 'low'

export interface RollNote {
  id: string
  pitch: number // MIDI
  hand: 'left' | 'right'
  t0: number // seconds on the decoded-PCM timeline
  t1: number
  band: RollBand
}

export interface RollTheme {
  family: string
  barNumberPx: number
  ink: string
  staff: string
  playhead: string
  loopFill: string
  loopEdge: string
  barLabel: string
  medium: string
  low: string
  left: string
  leftFg: string
  right: string
  rightFg: string
}

export interface PianoRollProps {
  /** By onset. */
  notes: readonly RollNote[]
  /** First and last key (MIDI, both white), as on the KeyboardDiagram under the roll. */
  from: number
  to: number
  /** Playback position in seconds. */
  clock: () => number
  /** Seconds shown above the now line. */
  span: number
  /** Bar starts with their labels ("12"), and the beat times between them. */
  bars: readonly { t: number; label: string }[]
  beats: readonly number[]
  loop: { t0: number; t1: number } | null
  /** Reduced motion: the start of the page that holds a time (the window steps page by page). */
  page?: ((t: number) => number) | undefined
  showUncertainty: boolean
  /** A hand drawn faintly (practising the other one). */
  dim?: 'left' | 'right' | undefined
  theme: RollTheme
  label: string
  /** A click on the roll: the time under the pointer. */
  onTimeActivate?: (t: number) => void
  className?: string
}

/** The keys a roll should show for these pitches: whole octaves from C, at least C3–C6. */
export function rollRange(pitches: readonly number[]): { from: number; to: number } {
  const low = Math.min(48, ...pitches)
  const high = Math.max(84, ...pitches)
  return {
    from: Math.max(21, low - (low % 12)),
    to: Math.min(108, high + ((12 - (high % 12)) % 12)),
  }
}

/** The seconds a roll shows at a time: from `start` (at the now line) for `span` above it. */
export function rollWindow(
  now: number,
  span: number,
  page?: (t: number) => number,
): { start: number; end: number } {
  const start = page ? page(now) : now
  return { start, end: start + span }
}

/** The notes sounding at `t`: `notes` by onset, none longer than `longest` seconds. */
export function soundingNotes<T extends Pick<RollNote, 't0' | 't1'>>(
  notes: readonly T[],
  t: number,
  longest: number,
): T[] {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((notes[mid] as T).t0 <= t) lo = mid + 1
    else hi = mid
  }
  const out: T[] = []
  for (let i = lo - 1; i >= 0; i--) {
    const note = notes[i] as T
    if (note.t0 < t - longest) break
    if (note.t1 > t) out.push(note)
  }
  return out.reverse()
}

// First note that may still sound at `start`: notes are by onset, none longer than `longest`.
function firstVisible(notes: readonly RollNote[], start: number, longest: number): number {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((notes[mid] as RollNote).t0 < start - longest) lo = mid + 1
    else hi = mid
  }
  return lo
}

interface Frame {
  props: PianoRollProps
  longest: number
}

function draw(
  context: CanvasRenderingContext2D,
  w: number,
  h: number,
  { props, longest }: Frame,
  now: number,
) {
  const { notes, from, to, span, bars, beats, loop, theme, showUncertainty, dim } = props
  const { start, end } = rollWindow(now, span, props.page)
  const y = (t: number) => h - ((t - start) / span) * h
  const { keys, width } = keyboardKeys(from, to)
  const scale = w / (width + 1)
  const lanes = new Map(keys.map((k) => [k.midi, k]))
  context.clearRect(0, 0, w, h)

  if (loop && loop.t1 > start && loop.t0 < end) {
    const top = Math.max(0, y(loop.t1))
    const bottom = Math.min(h, y(loop.t0))
    context.fillStyle = theme.loopFill
    context.fillRect(0, top, w, bottom - top)
    context.fillStyle = theme.loopEdge
    for (const edge of [loop.t0, loop.t1]) {
      if (edge >= start && edge <= end) context.fillRect(0, y(edge) - 1, w, 2)
    }
  }

  // Octave guides at each C, beat and bar lines across.
  context.fillStyle = theme.staff
  context.globalAlpha = 0.35
  for (const key of keys) {
    if (key.midi % 12 === 0) context.fillRect(Math.round((key.x + 0.5) * scale), 0, 1, h)
  }
  for (const t of beats) if (t >= start && t <= end) context.fillRect(0, Math.round(y(t)), w, 1)
  context.globalAlpha = 1
  context.font = `${theme.barNumberPx}px ${theme.family}`
  context.textBaseline = 'bottom'
  for (const bar of bars) {
    if (bar.t < start || bar.t > end) continue
    const at = Math.round(y(bar.t))
    context.fillStyle = theme.staff
    context.fillRect(0, at - 1, w, 2)
    context.fillStyle = theme.barLabel
    context.fillText(bar.label, 4, at - 3)
  }

  const letterPx = Math.min(16, Math.max(9, scale * 6))
  context.textAlign = 'center'
  for (let i = firstVisible(notes, start, longest); i < notes.length; i++) {
    const note = notes[i] as RollNote
    if (note.t0 > end) break
    if (note.t1 <= start) continue
    const key = lanes.get(note.pitch)
    if (!key) continue
    const x = (key.x + 0.5) * scale + 1
    const nw = key.width * scale - 2
    const top = Math.max(-4, y(note.t1))
    const bottom = Math.min(h + 4, y(note.t0))
    const nh = Math.max(3, bottom - top)
    const left = note.hand === 'left'
    context.globalAlpha = dim === note.hand ? 0.3 : 1
    context.fillStyle = left ? theme.left : theme.right
    context.beginPath()
    context.roundRect(x, bottom - nh, nw, nh, left ? 0 : Math.min(4, nw / 3))
    context.fill()
    const unsure = showUncertainty && note.band !== 'high'
    if (unsure) context.setLineDash([4, 3])
    context.lineWidth = unsure || left ? 2 : 1
    context.strokeStyle = unsure
      ? note.band === 'low'
        ? theme.low
        : theme.medium
      : left
        ? theme.ink
        : theme.staff
    context.stroke()
    context.setLineDash([])
    if (nh >= letterPx + 4 && nw >= letterPx * 0.7) {
      context.font = `700 ${letterPx}px ${theme.family}`
      context.fillStyle = note.hand === 'left' ? theme.leftFg : theme.rightFg
      context.fillText(note.hand === 'left' ? 'L' : 'R', x + nw / 2, bottom - 2)
    }
    if (showUncertainty && note.band === 'low') {
      context.font = `700 ${letterPx}px ${theme.family}`
      context.fillStyle = theme.low
      context.fillText('?', x + nw / 2, bottom - nh - 2)
    }
  }
  context.globalAlpha = 1
  context.textAlign = 'start'

  context.fillStyle = theme.playhead
  context.fillRect(0, props.page ? y(now) - 1 : h - 2, w, 2)
}

export function PianoRoll(props: PianoRollProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<Frame>({ props, longest: 0 })
  frame.current.props = props
  const { notes } = props
  useEffect(() => {
    frame.current.longest = notes.reduce((max, n) => Math.max(max, n.t1 - n.t0), 0)
  }, [notes])

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
      if (size.w === 0 || size.h === 0) return
      context.setTransform(size.ratio, 0, 0, size.ratio, 0, 0)
      draw(context, size.w, size.h, frame.current, frame.current.props.clock())
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
      role="img"
      aria-label={props.label}
      data-slot="piano-roll"
      className={props.className}
      onClick={(event) => {
        const { onTimeActivate, clock, span, page } = frame.current.props
        if (!onTimeActivate) return
        const box = event.currentTarget.getBoundingClientRect()
        const { start } = rollWindow(clock(), span, page)
        onTimeActivate(start + ((box.bottom - event.clientY) / box.height) * span)
      }}
    />
  )
}
