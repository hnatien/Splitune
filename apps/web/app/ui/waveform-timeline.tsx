import { readColor, type TokenName } from '@splitune/ui-tokens'
import type * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §4.7, §12.2, s47 direction §3, §6: the song map. Section chips over the waveform (a chip
// loops its section; 24 px tall on fine pointers, 44 on coarse ones; the looped section's chip has
// a 2 px ink line), then a 30 px row of waveform bars from your part (or the song before stems) on
// a canvas: unplayed bars in `--waveform-peak`, the part already played in the stronger
// `--waveform-played`, and the bars inside the loop in the ink. The loop is an ink-edged band
// (`--loop-fill` beneath the bars, 2 px `--loop-edge` edges), the playhead a 2 px ink line that
// follows the audio clock, and unsure bars a striped band above the waveform (a pattern, never
// colour alone, 26 §5). Without sections a ruler names the bars every 8 bars (or the seconds before
// the beat is known). The loop's edges are ≥ 44 px handles that the arrow keys nudge (dragging is
// the secondary way). Tap seeks and a drag across the map scrubs (the caller snaps it to bars);
// pointer capture keeps it going past the edges. The waveform is drawn when its data changes;
// during playback only the playhead moves (transform) and the played part is revealed by a clip on
// a second canvas, so no frame reads layout (28 §3.1). The loop band eases in, out and between
// ranges over --duration-base (straight to the end state under reduced motion). `compact` (phone
// landscape, 27 §3.7.2) keeps the band and the playhead over bar ticks in 32 px. The canvas is
// decorative for assistive tech: seeking and the loop are reachable through the transport, the
// section chips and the handles' keys.

export interface TimelineLane {
  id: string
  label: string
  /** Min/max pairs per block. */
  peaks: Float32Array
  /** RMS per block. */
  rms: Float32Array
}

export interface TimelineBar {
  bar: number
  start: number
  label: string
}

/** A named part of the song ("Verse"), in seconds on the decoded-PCM timeline. */
export interface TimelineSection {
  start: number
  end: number
  label: string
}

type WaveformTimelineProps = {
  lanes: TimelineLane[]
  duration: number
  /** Downbeats for the ruler; omitted before the beat grid exists (seconds ruler). */
  bars?: TimelineBar[] | undefined
  loop?: { start: number; end: number } | null
  unsure?: { start: number; end: number }[]
  /** Section chips over the waveform; without them the map shows a bar ruler. */
  sections?: TimelineSection[] | undefined
  /** Loops a section (its chip was pressed); chips are plain labels without it. */
  onLoopSection?: ((section: TimelineSection) => void) | undefined
  /** Heard position (seconds), read every animation frame. */
  position: () => number
  /** Pressing seeks; dragging across the map keeps seeking (`scrubbing`) until release. */
  onSeek: (seconds: number, scrubbing: boolean) => void
  /** Moves a loop edge by a step (keys on the handles; the drag is the secondary way). */
  onNudgeLoop?: (edge: 'start' | 'end', direction: 1 | -1) => void
  onDragLoop?: (edge: 'start' | 'end', seconds: number) => void
  labels: {
    loopStart: string
    loopEnd: string
    /** Names the row of section chips ("Sections"). */
    sections?: string
  }
  /** Ruler only (phone landscape, 27 §3.7.2). */
  compact?: boolean
  className?: string
}

/** The loop band's ease, in milliseconds: `--duration-base`, which a canvas can't take from CSS. */
const BAND_MS = 200
// Rows of the map's canvas: the 4 px hatch band, then the 30 px waveform with the loop band 2 px
// beyond it on both sides; the playhead runs from 3 px down to the foot.
const HOST_PX = 40
const HATCH = { top: 0, height: 4 }
const MAP = { top: 7, height: 30 }
const BAND_OVER = 2
const COLUMN_PX = 5
const COMPACT_PX = 32
// Bar numbers every 8 bars (27 §3.7.1), thinned further when they'd crowd.
const RULER_EVERY = 8
const RULER_GAP_PX = 28

/** A loop within this many seconds of a section's ends is that section's loop. */
const SAME_S = 0.05

/** Pointer capture, where the platform grants it (synthetic and some pen pointers are refused). */
function capture(element: Element, pointer: number) {
  try {
    element.setPointerCapture(pointer)
  } catch {
    // The drag still runs from the pressed pointer's moves inside the map.
  }
}

/** The loop band as drawn: the range and how opaque it is, so it can ease in, out and between. */
interface Band {
  start: number
  end: number
  alpha: number
}

function reducedMotion() {
  const motion = document.documentElement.getAttribute('data-motion')
  return motion === 'reduce' || (!motion && matchMedia('(prefers-reduced-motion: reduce)').matches)
}

/** The map's colours as its own subtree resolves them (a themed subtree may differ from the page). */
function colors(element?: Element) {
  const read = (name: TokenName) => readColor(name, element)
  return {
    peak: read('--waveform-peak'),
    played: read('--waveform-played'),
    inLoop: read('--waveform-loop'),
    loopFill: read('--loop-fill'),
    loopEdge: read('--loop-edge'),
    hatch: read('--hatch'),
    rule: read('--edge'),
  }
}

/** One loudness per column: the loudest block in each, 0–1 against the song's loudest. */
export function columnLevels(lane: TimelineLane | undefined, columns: number) {
  const levels = new Float32Array(Math.max(0, columns))
  if (!lane || columns <= 0) return levels
  const blocks = lane.rms.length
  let loudest = 0
  for (let b = 0; b < blocks; b++) {
    loudest = Math.max(loudest, Math.abs(lane.peaks[2 * b] ?? 0), lane.peaks[2 * b + 1] ?? 0)
  }
  const per = blocks / columns
  for (let c = 0; c < columns; c++) {
    let peak = 0
    for (let b = Math.floor(c * per); b < Math.min(blocks, Math.ceil((c + 1) * per)); b++) {
      peak = Math.max(peak, Math.abs(lane.peaks[2 * b] ?? 0), lane.peaks[2 * b + 1] ?? 0)
    }
    levels[c] = loudest > 0 ? peak / loudest : 0
  }
  return levels
}

function WaveformTimeline({
  lanes,
  duration,
  bars,
  loop = null,
  unsure = [],
  sections,
  onLoopSection,
  position,
  onSeek,
  onNudgeLoop,
  onDragLoop,
  labels,
  compact = false,
  className,
}: WaveformTimelineProps) {
  const host = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLCanvasElement>(null)
  const played = useRef<HTMLCanvasElement>(null)
  const nowLine = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [palette, setPalette] = useState<ReturnType<typeof colors> | null>(null)
  const band = useRef<Band | null>(loop && { ...loop, alpha: 1 })
  const tween = useRef<{ from: Band; to: Band; at: number } | null>(null)
  const redraw = useRef(() => {})
  const loopStart = loop?.start
  const loopEnd = loop?.end
  const height = compact ? COMPACT_PX : HOST_PX
  const x = (seconds: number) => (seconds / Math.max(1e-6, duration)) * width

  // Size and appearance changes redraw (colours are read from the tokens each time).
  useEffect(() => {
    const element = host.current
    if (!element) return
    const resize = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0))
    resize.observe(element)
    setPalette(colors(element))
    const theme = new MutationObserver(() => setPalette(colors(element)))
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-appearance', 'data-contrast'],
    })
    return () => {
      resize.disconnect()
      theme.disconnect()
    }
  }, [])

  const lane = lanes[0]
  useEffect(() => {
    const canvases = [base.current, played.current]
    const contexts = canvases.map((c) => c?.getContext('2d') ?? null)
    if (width === 0 || !palette || contexts.some((c) => !c)) return
    const ratio = window.devicePixelRatio || 1
    canvases.forEach((c, i) => {
      if (!c) return
      c.width = Math.round(width * ratio)
      c.height = Math.round(height * ratio)
      contexts[i]?.setTransform(ratio, 0, 0, ratio, 0, 0)
    })
    const [back, front] = contexts
    if (!back || !front) return
    const columns = compact ? 0 : Math.floor(width / COLUMN_PX)
    const levels = columnLevels(lane, columns)
    const draw = () => {
      back.clearRect(0, 0, width, height)
      front.clearRect(0, 0, width, height)
      const shown = band.current
      const at = (seconds: number) => (seconds / Math.max(1e-6, duration)) * width
      const bandTop = compact ? 0 : MAP.top - BAND_OVER
      const bandHeight = compact ? height : MAP.height + 2 * BAND_OVER
      if (shown) {
        back.globalAlpha = shown.alpha
        back.fillStyle = palette.loopFill
        back.fillRect(at(shown.start), bandTop, at(shown.end) - at(shown.start), bandHeight)
        back.globalAlpha = 1
      }
      // Waveform bars over the band: in the loop the ink, else unplayed (base) and played (front).
      const columnW = width / Math.max(1, columns)
      for (let c = 0; c < columns; c++) {
        const level = Math.max(0.06, levels[c] ?? 0)
        const h = Math.max(2, level * MAP.height)
        const left = c * columnW
        const mid = (c + 0.5) * (duration / Math.max(1, columns))
        const inLoop = shown !== null && shown.alpha > 0.5 && mid >= shown.start && mid < shown.end
        const top = MAP.top + (MAP.height - h) / 2
        back.fillStyle = inLoop ? palette.inLoop : palette.peak
        back.fillRect(left, top, Math.max(1, columnW - 1), h)
        if (!inLoop) {
          front.fillStyle = palette.played
          front.fillRect(left, top, Math.max(1, columnW - 1), h)
        }
      }
      // Unsure bars: a striped band above the waveform (135°, 2 px on, 2 px off).
      if (!compact) {
        back.strokeStyle = palette.hatch
        back.lineWidth = 1.4
        for (const range of unsure) {
          const left = at(range.start)
          const right = at(range.end)
          if (right < 0 || left > width) continue
          back.save()
          back.beginPath()
          back.rect(left, HATCH.top, right - left, HATCH.height)
          back.clip()
          back.beginPath()
          for (let p = left - HATCH.height; p < right + HATCH.height; p += 4) {
            back.moveTo(p, HATCH.top + HATCH.height)
            back.lineTo(p + HATCH.height, HATCH.top)
          }
          back.stroke()
          back.restore()
        }
      }
      if (compact) {
        back.strokeStyle = palette.rule
        back.lineWidth = 1
        for (const bar of bars ?? []) {
          const px = Math.round(at(bar.start)) + 0.5
          back.beginPath()
          back.moveTo(px, height - 8)
          back.lineTo(px, height)
          back.stroke()
        }
      }
      if (shown) {
        back.globalAlpha = shown.alpha
        back.fillStyle = palette.loopEdge
        back.fillRect(at(shown.start), bandTop, 2, bandHeight)
        back.fillRect(at(shown.end) - 2, bandTop, 2, bandHeight)
        back.globalAlpha = 1
      }
    }
    redraw.current = draw
    draw()
  }, [lane, duration, bars, unsure, width, height, compact, palette])

  // A new, moved or removed loop starts the band's ease from what is drawn now.
  useEffect(() => {
    const from = band.current
    const to =
      loopStart === undefined || loopEnd === undefined
        ? null
        : { start: loopStart, end: loopEnd, alpha: 1 }
    if (from?.start === to?.start && from?.end === to?.end && from?.alpha === to?.alpha) return
    if (reducedMotion()) {
      tween.current = null
      band.current = to
      redraw.current()
      return
    }
    const origin = from ?? (to && { ...to, alpha: 0 })
    const target = to ?? (from && { ...from, alpha: 0 })
    if (origin && target) tween.current = { from: origin, to: target, at: performance.now() }
  }, [loopStart, loopEnd])

  // The now-line follows the clock and the played canvas is revealed up to it; the loop band's
  // ease steps on the same frame. Only transforms and a clip change: no layout is read.
  useEffect(() => {
    let frame = 0
    let lastX = Number.NaN
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const move = tween.current
      if (move) {
        const done = Math.min(1, (performance.now() - move.at) / BAND_MS)
        const k = 1 - (1 - done) ** 3
        const mix = (a: number, b: number) => a + (b - a) * k
        band.current =
          done < 1
            ? {
                start: mix(move.from.start, move.to.start),
                end: mix(move.from.end, move.to.end),
                alpha: mix(move.from.alpha, move.to.alpha),
              }
            : move.to.alpha === 0
              ? null
              : move.to
        if (done === 1) tween.current = null
        redraw.current()
      }
      if (width === 0) return
      const now = Math.round(x(position()) * 2) / 2
      if (now === lastX) return
      lastX = now
      if (nowLine.current) nowLine.current.style.transform = `translateX(${now}px)`
      if (played.current)
        played.current.style.clipPath = `inset(0 ${Math.max(0, width - now)}px 0 0)`
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  })

  // The pointer that pressed the map; its moves scrub until it is released. Capture keeps the moves
  // coming past the map's edges where the platform supports it, but the drag never depends on it.
  const pressed = useRef<number | null>(null)
  const seekAt = (event: React.PointerEvent<HTMLDivElement>, scrubbing: boolean) => {
    const box = event.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    onSeek(fraction * duration, scrubbing)
  }

  const dragging = useRef<{ edge: 'start' | 'end'; pointer: number } | null>(null)
  const handle = (edge: 'start' | 'end') => {
    if (!loop || compact) return null
    const at = x(loop[edge])
    if (at < 0 || at > width) return null
    return (
      <button
        type="button"
        aria-label={edge === 'start' ? labels.loopStart : labels.loopEnd}
        data-slot="loop-handle"
        className="group/handle absolute top-1/2 z-10 flex size-target -translate-1/2 cursor-ew-resize items-center justify-center rounded-full"
        style={{ left: at }}
        onKeyDown={(event) => {
          const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
          if (direction === 0 || !onNudgeLoop) return
          event.preventDefault()
          event.stopPropagation()
          onNudgeLoop(edge, direction)
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
          dragging.current = { edge, pointer: event.pointerId }
          capture(event.currentTarget, event.pointerId)
        }}
        onPointerUp={(event) => {
          event.stopPropagation()
          dragging.current = null
        }}
        onPointerCancel={() => {
          dragging.current = null
        }}
        onPointerMove={(event) => {
          const drag = dragging.current
          if (!onDragLoop || drag?.edge !== edge || drag.pointer !== event.pointerId) return
          const box = host.current?.getBoundingClientRect()
          if (!box) return
          onDragLoop(edge, ((event.clientX - box.left) / box.width) * duration)
        }}
      >
        <span
          aria-hidden
          // The grip shows at rest (a touch screen has no hover) and takes the loop's ink when used.
          className="h-6 w-1.5 rounded-full bg-edge transition-colors duration-(--duration-fast) ease-standard group-hover/handle:bg-loop-edge group-focus-visible/handle:bg-loop-edge"
        />
      </button>
    )
  }

  // Ruler marks: every 8th bar from the first (or each half minute before the beat is known).
  const marks: { at: number; label: string }[] = []
  const chips = !compact && sections && sections.length > 0 ? sections : null
  if (!compact && !chips && width > 0) {
    const ticks = bars
      ? bars.filter((b) => b.bar >= 0 && b.bar % RULER_EVERY === 0)
      : Array.from({ length: Math.floor(duration / 30) + 1 }, (_, i) => ({
          start: i * 30,
          label: `${Math.floor((i * 30) / 60)}:${String((i * 30) % 60).padStart(2, '0')}`,
        }))
    let last = Number.NEGATIVE_INFINITY
    for (const tick of ticks) {
      const px = x(tick.start)
      if (px - last < RULER_GAP_PX || px > width - 12) continue
      marks.push({ at: px, label: tick.label })
      last = px
    }
  }

  const span = Math.max(1e-6, duration)
  const looped = (section: TimelineSection) =>
    loop !== null &&
    Math.abs(loop.start - section.start) < SAME_S &&
    Math.abs(loop.end - section.end) < SAME_S
  const chipRow = chips?.map((section) => {
    const style = {
      left: `${(Math.max(0, section.start) / span) * 100}%`,
      width: `${((Math.min(duration, section.end) - Math.max(0, section.start)) / span) * 100}%`,
    }
    const face =
      'absolute inset-y-0 flex min-w-0 items-center truncate border-l border-edge pr-1 pl-1.5 text-label-sm whitespace-nowrap'
    return onLoopSection ? (
      <button
        key={`${section.label}-${section.start}`}
        type="button"
        data-slot="section-chip"
        aria-pressed={looped(section)}
        className={cn(
          face,
          'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 hover:bg-hover hover:text-foreground focus-visible:-outline-offset-2 aria-pressed:text-foreground aria-pressed:after:bg-selected',
        )}
        style={style}
        onClick={() => onLoopSection(section)}
      >
        <span className="truncate">{section.label}</span>
      </button>
    ) : (
      <span
        key={`${section.label}-${section.start}`}
        data-slot="section-chip"
        className={cn(face, 'text-muted-foreground')}
        style={style}
      >
        <span className="truncate">{section.label}</span>
      </span>
    )
  })
  return (
    <div data-slot="waveform-timeline" className={cn('flex flex-col', className)}>
      {chipRow &&
        (onLoopSection ? (
          <fieldset aria-label={labels.sections} className="m-0 min-w-0 border-0 p-0">
            <div
              data-slot="sections"
              className="relative h-target-min w-full pointer-coarse:h-target"
            >
              {chipRow}
            </div>
          </fieldset>
        ) : (
          <div data-slot="sections" className="relative h-target-min w-full">
            {chipRow}
          </div>
        ))}
      <div
        ref={host}
        className="relative w-full cursor-pointer touch-pan-y"
        style={{ height }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          pressed.current = event.pointerId
          capture(event.currentTarget, event.pointerId)
          seekAt(event, false)
        }}
        onPointerMove={(event) => {
          if (pressed.current === event.pointerId) seekAt(event, true)
        }}
        onPointerUp={(event) => {
          if (pressed.current === event.pointerId) pressed.current = null
        }}
        onPointerCancel={() => {
          pressed.current = null
        }}
      >
        <canvas ref={base} aria-hidden className="absolute inset-0 h-full w-full" />
        <canvas
          ref={played}
          aria-hidden
          data-slot="played"
          className="absolute inset-0 h-full w-full"
        />
        <div
          ref={nowLine}
          aria-hidden
          data-slot="now-line"
          className={cn(
            'pointer-events-none absolute left-0 w-0.5 -translate-x-px rounded-full bg-now-line will-change-transform',
            compact ? 'inset-y-0' : 'top-0.75 bottom-0',
          )}
        />
        {handle('start')}
        {handle('end')}
      </div>
      {!compact && !chips && (
        <div
          aria-hidden
          data-slot="ruler"
          className="relative h-4 text-caption text-faint-foreground tabular-nums"
        >
          {marks.map((mark) => (
            <span
              key={mark.at}
              className="absolute top-0 border-l border-edge pl-0.75 tabular-nums"
              style={{ left: mark.at }}
            >
              {mark.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export { WaveformTimeline }
