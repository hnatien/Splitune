import { MinusIcon, PlusIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { TransportButton } from '@/ui/transport-button'

// Doc 26 §12.2, 27 §5.3: −/+ steppers (5 %, 1 % with Shift), tap the readout for the slider
// (50–100 %, 25–200 % advanced) and the presets, which may also sit inline from `2xl`; readout
// "70 %" over "84 BPM". Boxed −/+ (`.ib.lg.box`, icons only, 26 §11) around a quiet readout
// button; all three are main practice controls, 64 px in every layout (§8, V11).

export const SPEED_STEP = 5
export const SPEED_FINE_STEP = 1

// The slider and presets load on first open, so the transport stays light (12 §10 route budget).
const SpeedPanel = lazy(() => import('./speed-panel').then((m) => ({ default: m.SpeedPanel })))
const SpeedPresets = lazy(() => import('./speed-panel').then((m) => ({ default: m.SpeedPresets })))

type SpeedControlProps = {
  /** Playback rate in percent of the original. */
  value: number
  onValueChange: (value: number) => void
  /** Original tempo; omit when the beat grid is unknown (the readout shows % only). */
  bpm?: number | undefined
  advanced?: boolean
  labels: {
    /** Accessible name of the readout button and slider, e.g. "Speed". */
    speed: string
    decrease: string
    increase: string
    presets: string
  }
  shortcuts?: { decrease?: string; increase?: string }
  /** Phones: a narrower readout so the transport fits two rows (the steppers stay 64 px, V11). */
  compact?: boolean
  /** The presets inline from `2xl` too (tablet transport); the desktop dock leaves them out. */
  inlinePresets?: boolean
  className?: string
}

const NBSP = ' '

/** The readout's number counts from the old speed to the new one over the base duration. */
function useTweened(target: number) {
  const [shown, setShown] = useState(target)
  const current = useRef(target)
  useEffect(() => {
    const root = document.documentElement
    const motion = root.getAttribute('data-motion')
    const reduced =
      motion === 'reduce' || (!motion && matchMedia('(prefers-reduced-motion: reduce)').matches)
    const duration = Number.parseFloat(getComputedStyle(root).getPropertyValue('--duration-base'))
    const origin = current.current
    if (reduced || !(duration > 0) || origin === target) {
      current.current = target
      setShown(target)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      current.current = progress < 1 ? Math.round(origin + (target - origin) * progress) : target
      setShown(current.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return shown
}

export function formatSpeed(percent: number, bpm?: number) {
  const pct = `${percent}${NBSP}%`
  return bpm === undefined ? pct : `${pct} · ${Math.round((bpm * percent) / 100)}${NBSP}BPM`
}

function SpeedControl({
  value,
  onValueChange,
  bpm,
  advanced = false,
  labels,
  shortcuts,
  compact = false,
  inlinePresets = true,
  className,
}: SpeedControlProps) {
  const [min, max] = advanced ? [25, 200] : [50, 100]
  const shown = useTweened(value)
  const set = (next: number) => onValueChange(Math.min(max, Math.max(min, next)))
  const step = (direction: 1 | -1) => (event: React.MouseEvent) =>
    set(value + direction * (event.shiftKey ? SPEED_FINE_STEP : SPEED_STEP))

  return (
    <div data-slot="speed-control" className={cn('inline-flex items-center gap-1', className)}>
      <TransportButton
        icon={<MinusIcon aria-hidden />}
        label={labels.decrease}
        showLabel={false}
        tone="box"
        shortcut={shortcuts?.decrease}
        disabled={value <= min}
        onClick={step(-1)}
      />
      <Popover>
        <PopoverTrigger
          aria-label={`${labels.speed}: ${formatSpeed(value, bpm)}`}
          className={cn(
            'flex min-h-target-practice flex-col items-center justify-center rounded-2xl px-3 text-center transition-colors hover:bg-accent aria-expanded:bg-accent',
            compact ? 'min-w-20' : 'min-w-26',
          )}
        >
          <span className="font-reading-mono text-read-readout tracking-[-0.01em] tabular-nums">
            {shown}
            {NBSP}%
          </span>
          {bpm !== undefined && (
            <span className="font-mono text-sm font-medium text-faint-foreground tabular-nums">
              {Math.round((bpm * shown) / 100)}
              {NBSP}BPM
            </span>
          )}
        </PopoverTrigger>
        <Suspense fallback={null}>
          <SpeedPanel
            value={value}
            min={min}
            max={max}
            onValueChange={set}
            labels={{ speed: labels.speed, presets: labels.presets }}
          />
        </Suspense>
      </Popover>
      <TransportButton
        icon={<PlusIcon aria-hidden />}
        label={labels.increase}
        showLabel={false}
        tone="box"
        shortcut={shortcuts?.increase}
        disabled={value >= max}
        onClick={step(1)}
      />
      {inlinePresets && (
        <div className="hidden 2xl:block">
          <Suspense fallback={<div aria-hidden className="h-target-practice-2 w-75" />}>
            <SpeedPresets
              value={value}
              onValueChange={set}
              label={labels.presets}
              className="bg-transparent p-0"
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export { SpeedControl }
