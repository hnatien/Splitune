import { useEffect, useRef } from 'react'

// Drum grid (step 25, 21 V5): one lane per part of the kit, cymbals and hi-hat at the top and the
// kick at the bottom, as on a drum staff, with time running left to right on the beat grid. The
// playhead stays a quarter of the way in and the hits scroll past it; with reduced motion the
// window holds still for a page and only the playhead moves. Bar lines carry their numbers, beat
// lines are faint, the loop is a shaded band with edges.
// Hits are filled blocks. An unsure hit (a kit-piece guess, or a medium or low confidence) is drawn
// hollow with the score's dashed outline, a low one also gets a "?", so certainty never rests on
// colour alone (26 §5). A flam has a small grace block just before it. Inside a lane the kit piece
// shows as a letter (open hi-hat "o", crash "C", ride "R", high/mid/floor tom "H"/"M"/"F") when
// the lane holds more than one piece. Drawn on a canvas from the clock every frame (the display
// never owns the clock, 12 §3).

export type DrumLane = 'cymbals' | 'hihat' | 'toms' | 'snare' | 'kick'

/** Top to bottom. */
export const DRUM_LANES: readonly DrumLane[] = ['cymbals', 'hihat', 'toms', 'snare', 'kick']

export interface GridHit {
  id: string
  lane: DrumLane
  gmNote: number
  t0: number // seconds on the decoded-PCM timeline
  band: 'high' | 'medium' | 'low'
  approximate: boolean
  flam: boolean
}

export interface DrumGridTheme {
  family: string
  barNumberPx: number
  ink: string
  paper: string
  staff: string
  playhead: string
  loopFill: string
  loopEdge: string
  barLabel: string
  medium: string
  low: string
}

export interface DrumGridProps {
  /** By onset. */
  hits: readonly GridHit[]
  clock: () => number
  /** Seconds in view. */
  span: number
  bars: readonly { t: number; label: string }[]
  beats: readonly number[]
  loop: { t0: number; t1: number } | null
  /** Reduced motion: the start of the page that holds a time. */
  page?: ((t: number) => number) | undefined
  showUncertainty: boolean
  theme: DrumGridTheme
  label: string
  /** A click on the grid: the time under the pointer. */
  onTimeActivate?: (t: number) => void
  className?: string
}

// GM key → the letter shown in its lane when the lane holds more than one piece.
const PIECE_LETTER: Readonly<Record<number, string>> = {
  46: 'o',
  44: 'p',
  49: 'C',
  52: 'C',
  55: 'C',
  57: 'C',
  51: 'R',
  53: 'R',
  59: 'R',
  48: 'H',
  50: 'H',
  47: 'M',
  45: 'L',
  41: 'F',
  43: 'F',
}

/** The playhead's share of the width from the left (scrolling mode). */
export const PLAYHEAD_AT = 0.25

/** The seconds in view: `span` around the playhead, or a page with reduced motion. */
export function gridWindow(
  now: number,
  span: number,
  page?: (t: number) => number,
): { start: number; end: number } {
  const start = page ? page(now) : now - span * PLAYHEAD_AT
  return { start, end: start + span }
}

/** Lanes whose hits are not all one kit piece (they show piece letters). */
export function mixedLanes(hits: readonly Pick<GridHit, 'lane' | 'gmNote'>[]): Set<DrumLane> {
  const pieces = new Map<DrumLane, Set<string>>()
  for (const h of hits) {
    const set = pieces.get(h.lane) ?? new Set<string>()
    set.add(PIECE_LETTER[h.gmNote] ?? '')
    pieces.set(h.lane, set)
  }
  return new Set([...pieces].filter(([, set]) => set.size > 1).map(([lane]) => lane))
}

/** Whether a hit is drawn as unsure (hollow, dashed). */
export function unsure(hit: Pick<GridHit, 'band' | 'approximate'>): boolean {
  return hit.approximate || hit.band !== 'high'
}

interface Frame {
  props: DrumGridProps
  mixed: Set<DrumLane>
}

function draw(
  context: CanvasRenderingContext2D,
  w: number,
  h: number,
  { props, mixed }: Frame,
  now: number,
) {
  const { hits, span, bars, beats, loop, theme, showUncertainty } = props
  const { start, end } = gridWindow(now, span, props.page)
  const x = (t: number) => ((t - start) / span) * w
  const top = theme.barNumberPx + 6
  const laneH = (h - top) / DRUM_LANES.length
  context.clearRect(0, 0, w, h)

  if (loop && loop.t1 > start && loop.t0 < end) {
    const left = Math.max(0, x(loop.t0))
    const right = Math.min(w, x(loop.t1))
    context.fillStyle = theme.loopFill
    context.fillRect(left, top, right - left, h - top)
    context.fillStyle = theme.loopEdge
    for (const edge of [loop.t0, loop.t1]) {
      if (edge >= start && edge <= end) context.fillRect(x(edge) - 1, top, 2, h - top)
    }
  }

  // Lane rules, faint beat lines, bar lines with their numbers above.
  context.fillStyle = theme.staff
  context.globalAlpha = 0.35
  for (let i = 1; i < DRUM_LANES.length; i++) context.fillRect(0, Math.round(top + i * laneH), w, 1)
  for (const t of beats)
    if (t >= start && t <= end) context.fillRect(Math.round(x(t)), top, 1, h - top)
  context.globalAlpha = 1
  context.font = `${theme.barNumberPx}px ${theme.family}`
  context.textBaseline = 'top'
  for (const bar of bars) {
    if (bar.t < start || bar.t > end) continue
    const at = Math.round(x(bar.t))
    context.fillStyle = theme.staff
    context.fillRect(at - 1, top, 2, h - top)
    context.fillStyle = theme.barLabel
    context.fillText(bar.label, at + 3, 2)
  }

  const size = Math.max(8, Math.min(22, laneH * 0.55, (w / span) * 0.09))
  const letterPx = Math.max(9, Math.min(14, size * 0.7))
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  for (const hit of hits) {
    if (hit.t0 < start - 0.2) continue
    if (hit.t0 > end) break
    const lane = DRUM_LANES.indexOf(hit.lane)
    const cx = x(hit.t0)
    const cy = top + (lane + 0.5) * laneH
    const doubt = showUncertainty && unsure(hit)
    const block = (bx: number, s: number) => {
      context.beginPath()
      context.roundRect(bx - s / 2, cy - s / 2, s, s, Math.min(3, s / 4))
      if (doubt) {
        context.fillStyle = theme.paper
        context.fill()
        context.setLineDash([4, 3])
        context.lineWidth = 2
        context.strokeStyle = hit.band === 'low' ? theme.low : theme.medium
        context.stroke()
        context.setLineDash([])
      } else {
        context.fillStyle = theme.ink
        context.fill()
      }
    }
    if (hit.flam) block(cx - size * 0.75, size * 0.5)
    block(cx, size)
    const letter = mixed.has(hit.lane) ? PIECE_LETTER[hit.gmNote] : undefined
    if (letter && size >= letterPx) {
      context.font = `700 ${letterPx}px ${theme.family}`
      context.fillStyle = doubt ? theme.ink : theme.paper
      context.fillText(letter, cx, cy + 1)
    }
    if (showUncertainty && hit.band === 'low') {
      context.font = `700 ${letterPx}px ${theme.family}`
      context.fillStyle = theme.low
      context.fillText('?', cx + size * 0.75, cy - size * 0.5)
    }
  }
  context.textAlign = 'start'

  context.fillStyle = theme.playhead
  context.fillRect(Math.round(x(now)) - 1, top, 2, h - top)
}

export function DrumGrid(props: DrumGridProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<Frame>({ props, mixed: new Set() })
  frame.current.props = props
  const { hits } = props
  useEffect(() => {
    frame.current.mixed = mixedLanes(hits)
  }, [hits])

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
      data-slot="drum-grid"
      className={props.className}
      onClick={(event) => {
        const { onTimeActivate, clock, span, page } = frame.current.props
        if (!onTimeActivate) return
        const box = event.currentTarget.getBoundingClientRect()
        const { start } = gridWindow(clock(), span, page)
        onTimeActivate(start + ((event.clientX - box.left) / box.width) * span)
      }}
    />
  )
}
