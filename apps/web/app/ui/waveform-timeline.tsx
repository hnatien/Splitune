import { readColor, type TokenName } from '@splitune/ui-tokens'
import { MinusIcon, PlusIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'

// Doc 26 §12.2: the practice timeline on a canvas — peak (outer) and RMS (inner) per lane, a bar
// ruler (or seconds before the beat grid exists), the loop band with edges and ≥44 px handles,
// hatching on unsure bars (a pattern, never colour alone, 26 §5) and the now-line. Tap seeks;
// zoom with the +/- buttons. The canvas is decorative for assistive tech: seeking and the loop
// are reachable through the transport and the handles' keys.

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

type WaveformTimelineProps = {
  lanes: TimelineLane[]
  /** Seconds per peak/RMS block. */
  blockSeconds: number
  duration: number
  /** Downbeats for the ruler; omitted before the beat grid exists (seconds ruler). */
  bars?: TimelineBar[] | undefined
  loop?: { start: number; end: number } | null
  unsure?: { start: number; end: number }[]
  /** Heard position (seconds), read every animation frame. */
  position: () => number
  onSeek: (seconds: number) => void
  /** Moves a loop edge by a step (keys on the handles; the drag is the secondary way). */
  onNudgeLoop?: (edge: 'start' | 'end', direction: 1 | -1) => void
  onDragLoop?: (edge: 'start' | 'end', seconds: number) => void
  labels: {
    zoomIn: string
    zoomOut: string
    loopStart: string
    loopEnd: string
  }
  /** Compact ruler only (phone landscape, 27 §3.7.2). */
  compact?: boolean
  className?: string
}

const ZOOMS = [1, 2, 4, 8]
const RULER_PX = 20

function colors() {
  const read = (name: TokenName) => readColor(name)
  return {
    peak: read('--waveform-peak'),
    rms: read('--waveform-rms'),
    loopFill: read('--loop-fill'),
    loopEdge: read('--loop-edge'),
    text: read('--muted-foreground'),
    rule: read('--border'),
    hatch: read('--muted-foreground'),
  }
}

function WaveformTimeline({
  lanes,
  blockSeconds,
  duration,
  bars,
  loop = null,
  unsure = [],
  position,
  onSeek,
  onNudgeLoop,
  onDragLoop,
  labels,
  compact = false,
  className,
}: WaveformTimelineProps) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const nowLine = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const [offset, setOffset] = useState(0)
  const [palette, setPalette] = useState(colors)
  const span = duration / zoom
  const viewStart = Math.min(offset, Math.max(0, duration - span))
  const x = (seconds: number) => ((seconds - viewStart) / Math.max(1e-6, span)) * width

  // Size and appearance changes redraw (colours are read from the tokens each time).
  useEffect(() => {
    const element = host.current
    if (!element) return
    const resize = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0))
    resize.observe(element)
    const theme = new MutationObserver(() => setPalette(colors()))
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-appearance', 'data-contrast'],
    })
    return () => {
      resize.disconnect()
      theme.disconnect()
    }
  }, [])

  const height = compact ? 32 : 104
  useEffect(() => {
    const c = canvas.current
    const context = c?.getContext('2d')
    if (!c || !context || width === 0) return
    const ratio = window.devicePixelRatio || 1
    c.width = Math.round(width * ratio)
    c.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    const x = (seconds: number) => ((seconds - viewStart) / Math.max(1e-6, span)) * width
    const laneTop = compact ? height : RULER_PX
    const laneHeight = compact ? 0 : (height - RULER_PX) / Math.max(1, lanes.length)

    if (loop) {
      context.fillStyle = palette.loopFill
      context.fillRect(x(loop.start), 0, x(loop.end) - x(loop.start), height)
    }
    // Unsure bars: 45° hatching over the lanes.
    context.strokeStyle = palette.hatch
    context.lineWidth = 1
    for (const range of unsure) {
      const left = x(range.start)
      const right = x(range.end)
      if (right < 0 || left > width) continue
      context.save()
      context.beginPath()
      context.rect(left, laneTop, right - left, height - laneTop || height)
      context.clip()
      context.beginPath()
      for (let p = left - height; p < right; p += 6) {
        context.moveTo(p, height)
        context.lineTo(p + height, 0)
      }
      context.stroke()
      context.restore()
    }

    lanes.forEach((lane, index) => {
      const top = laneTop + index * laneHeight
      const mid = top + laneHeight / 2
      // Each lane fills its height (a quiet stem stays readable), at most 8× its level.
      let loudest = 0
      for (const value of lane.peaks) loudest = Math.max(loudest, Math.abs(value))
      const gain = loudest > 0 ? Math.min(8, 1 / loudest) : 1
      const firstBlock = Math.max(0, Math.floor(viewStart / blockSeconds))
      const lastBlock = Math.min(lane.rms.length, Math.ceil((viewStart + span) / blockSeconds))
      const step = Math.max(1, Math.floor((lastBlock - firstBlock) / Math.max(1, width)))
      for (let b = firstBlock; b < lastBlock; b += step) {
        let min = 0
        let max = 0
        let rms = 0
        for (let k = b; k < Math.min(lastBlock, b + step); k++) {
          min = Math.min(min, lane.peaks[2 * k] ?? 0)
          max = Math.max(max, lane.peaks[2 * k + 1] ?? 0)
          rms = Math.max(rms, lane.rms[k] ?? 0)
        }
        const px = x(b * blockSeconds)
        const w = Math.max(1, x((b + step) * blockSeconds) - px - 0.5)
        const half = (laneHeight / 2 - 1) * gain
        context.fillStyle = palette.peak
        context.fillRect(px, mid - max * half, w, Math.max(1, (max - min) * half))
        context.fillStyle = palette.rms
        context.fillRect(px, mid - rms * half, w, Math.max(1, 2 * rms * half))
      }
    })

    // Ruler: bar numbers (or seconds), thinned to what fits.
    context.fillStyle = palette.text
    context.strokeStyle = palette.rule
    context.font = '12px Inter, ui-sans-serif, system-ui, sans-serif'
    context.textBaseline = 'top'
    const ticks = bars
      ? bars.map((b) => ({ at: b.start, label: b.label }))
      : Array.from({ length: Math.floor(duration) + 1 }, (_, s) => ({
          at: s,
          label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
        }))
    let lastLabel = Number.NEGATIVE_INFINITY
    for (const tick of ticks) {
      const px = x(tick.at)
      if (px < -1 || px > width + 1) continue
      context.beginPath()
      context.moveTo(px + 0.5, 0)
      context.lineTo(px + 0.5, compact ? height : RULER_PX - 4)
      context.stroke()
      if (!compact && px - lastLabel >= 28) {
        context.fillText(tick.label, px + 3, 2)
        lastLabel = px
      }
    }
    if (loop) {
      context.fillStyle = palette.loopEdge
      context.fillRect(x(loop.start) - 1, 0, 2, height)
      context.fillRect(x(loop.end) - 1, 0, 2, height)
    }
  }, [
    lanes,
    blockSeconds,
    duration,
    bars,
    loop,
    unsure,
    width,
    height,
    compact,
    viewStart,
    span,
    palette,
  ])

  // The now-line follows the clock; a zoomed view pages along with it.
  useEffect(() => {
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const seconds = position()
      const line = nowLine.current
      if (!line || width === 0) return
      if (zoom > 1 && (seconds < viewStart || seconds > viewStart + span)) {
        setOffset(Math.max(0, seconds - span * 0.1))
      }
      line.style.transform = `translateX(${x(seconds)}px)`
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  })

  const seekAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    onSeek(viewStart + ((event.clientX - box.left) / box.width) * span)
  }

  const handle = (edge: 'start' | 'end') => {
    if (!loop || compact) return null
    const at = x(loop[edge])
    if (at < 0 || at > width) return null
    return (
      <button
        type="button"
        aria-label={edge === 'start' ? labels.loopStart : labels.loopEnd}
        data-slot="loop-handle"
        className="absolute top-0 z-10 flex h-full w-11 -translate-x-1/2 cursor-ew-resize items-start justify-center focus-visible:outline-2 focus-visible:outline-ring"
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
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerUp={(event) => event.stopPropagation()}
        onPointerMove={(event) => {
          if (!onDragLoop || !event.currentTarget.hasPointerCapture(event.pointerId)) return
          const box = host.current?.getBoundingClientRect()
          if (!box) return
          onDragLoop(edge, viewStart + ((event.clientX - box.left) / box.width) * span)
        }}
      >
        <span aria-hidden className="mt-0 h-5 w-4 rounded-b-md bg-loop-edge" />
      </button>
    )
  }

  return (
    <div data-slot="waveform-timeline" className={cn('flex items-stretch gap-2', className)}>
      <div
        ref={host}
        className="relative min-w-0 flex-1 cursor-pointer overflow-hidden rounded-lg border border-border bg-card"
        style={{ height }}
        onPointerUp={seekAt}
      >
        <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
        <div
          ref={nowLine}
          aria-hidden
          data-slot="now-line"
          className="pointer-events-none absolute top-0 left-0 h-full w-0.5 bg-playhead will-change-transform"
        />
        {handle('start')}
        {handle('end')}
      </div>
      {!compact && (
        <div className="flex flex-col justify-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={labels.zoomIn}
            disabled={zoom === ZOOMS.at(-1)}
            onClick={() => setZoom(ZOOMS[ZOOMS.indexOf(zoom) + 1] ?? zoom)}
          >
            <PlusIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={labels.zoomOut}
            disabled={zoom === 1}
            onClick={() => setZoom(ZOOMS[ZOOMS.indexOf(zoom) - 1] ?? 1)}
          >
            <MinusIcon aria-hidden />
          </Button>
        </div>
      )}
    </div>
  )
}

export { WaveformTimeline }
