import { MinusIcon, PlusIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/ui/kbd'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { LadderIcon } from '@/ui/speed-ladder'
import { TransportButton } from '@/ui/transport-button'

// Doc 26 §12.2, 27 §5.3, s47 direction §6–§7: − / readout / +, the steppers quiet 48 px circles
// (5 %, 1 % with Shift) with their key caps. The readout is "70 %" over "70 BPM" in tabular
// figures and a fixed width, so the transport never moves as the speed changes; it opens the speed
// panel (presets and a typed field, focused on open, so S → type → Enter sets a speed). While the
// speed ladder is on, the readout says so on the control: the ladder mark and its goal after the
// BPM ("72 BPM · → 100"). The presets may also sit inline from `2xl` (tablet transport).

export const SPEED_STEP = 5
export const SPEED_FINE_STEP = 1

// The panel and presets load on first open, so the transport stays light (12 §10 route budget).
const SpeedPanel = lazy(() => import('./speed-panel').then((m) => ({ default: m.SpeedPanel })))
const SpeedPresets = lazy(() => import('./speed-panel').then((m) => ({ default: m.SpeedPresets })))

type SpeedControlProps = {
  /** Playback rate in percent of the original. */
  value: number
  onValueChange: (value: number) => void
  /** Original tempo; omit when the beat grid is unknown (the readout shows % only). */
  bpm?: number | undefined
  /** The speed ladder's goal: `text` after the BPM ("→ 100"), `label` in the readout's name. */
  goal?: { text: string; label: string } | undefined
  advanced?: boolean
  labels: {
    /** Accessible name of the readout button and the panel, e.g. "Speed". */
    speed: string
    decrease: string
    increase: string
    presets: string
    /** The typed field's name, e.g. "Speed in percent"; defaults to `speed`. */
    field?: string
  }
  /** Key caps: −/+ steppers and the key that opens the panel ("S"). */
  shortcuts?: { decrease?: string; increase?: string; open?: string }
  /**
   * The panel's open state, for opening it from a key (`S`); uncontrolled when omitted. On open
   * the typed field has focus with its text selected; Enter sets the speed and closes it.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Phones: a narrower readout so the transport fits two rows. */
  compact?: boolean
  /** The presets inline from `2xl` too (tablet transport); the desktop dock leaves them out. */
  inlinePresets?: boolean
  className?: string
}

const NBSP = ' '

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
  goal,
  advanced = false,
  labels,
  shortcuts,
  open,
  onOpenChange,
  compact = false,
  inlinePresets = true,
  className,
}: SpeedControlProps) {
  const [min, max] = advanced ? [25, 200] : [50, 100]
  const shown = useTweened(value)
  const set = (next: number) => onValueChange(Math.min(max, Math.max(min, next)))
  // Open by its trigger, or by the caller (the `S` key) when `open` is given.
  const [ownOpen, setOwnOpen] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const shownOpen = open ?? ownOpen
  const setOpen = (next: boolean) => {
    if (open === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }
  const step = (direction: 1 | -1) => (event: React.MouseEvent) =>
    set(value + direction * (event.shiftKey ? SPEED_FINE_STEP : SPEED_STEP))

  return (
    <div data-slot="speed-control" className={cn('inline-flex items-center', className)}>
      <TransportButton
        icon={<MinusIcon aria-hidden />}
        label={labels.decrease}
        showLabel={false}
        shortcut={shortcuts?.decrease}
        disabled={value <= min}
        onClick={step(-1)}
      />
      <Popover
        open={shownOpen}
        onOpenChange={setOpen}
        // Once open (and focused), the typed speed is selected, so "70" and Enter replace it.
        onOpenChangeComplete={(opened) => {
          if (opened) field.current?.select()
        }}
      >
        <PopoverTrigger
          data-slot="speed-readout"
          data-ladder={goal ? '' : undefined}
          aria-keyshortcuts={shortcuts?.open}
          className={cn(
            'inline-flex min-h-target-practice items-center justify-center gap-2 rounded-full px-3 text-center inset-ring inset-ring-transparent transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard hover:bg-hover aria-expanded:inset-ring-[1.5px] aria-expanded:inset-ring-selected',
            compact ? 'min-w-18' : 'min-w-24',
          )}
        >
          <span className="sr-only">
            {`${labels.speed}: ${formatSpeed(value, bpm)}${goal ? ` · ${goal.text}, ${goal.label}` : ''}`}
          </span>
          <span aria-hidden className="flex flex-col items-center leading-none">
            <span className="min-w-[5ch] text-center font-reading text-read-readout tabular-nums">
              {shown}
              {NBSP}%
            </span>
            {/* The line is kept before the tempo is known, so the control (and the transport
                with it) is the same height when the beat arrives. */}
            <span
              data-slot="speed-detail"
              className="flex items-center gap-1 text-caption whitespace-nowrap text-muted-foreground tabular-nums"
            >
              {bpm === undefined && !goal && NBSP}
              {bpm !== undefined && `${Math.round((bpm * shown) / 100)}${NBSP}BPM`}
              {goal && (
                <>
                  {bpm !== undefined && ' · '}
                  <LadderIcon aria-hidden className="size-3.5 stroke-[1.8]" />
                  {goal.text}
                </>
              )}
            </span>
          </span>
          {shortcuts?.open && (
            <Kbd aria-hidden className="pointer-coarse:hidden">
              {shortcuts.open}
            </Kbd>
          )}
        </PopoverTrigger>
        <Suspense fallback={null}>
          <SpeedPanel
            value={value}
            min={min}
            max={max}
            onValueChange={set}
            labels={{
              speed: labels.speed,
              presets: labels.presets,
              field: labels.field ?? labels.speed,
              decrease: labels.decrease,
              increase: labels.increase,
            }}
            goal={goal?.label}
            onDone={() => setOpen(false)}
            fieldRef={field}
          />
        </Suspense>
      </Popover>
      <TransportButton
        icon={<PlusIcon aria-hidden />}
        label={labels.increase}
        showLabel={false}
        shortcut={shortcuts?.increase}
        disabled={value >= max}
        onClick={step(1)}
      />
      {inlinePresets && (
        <div className="ml-2 hidden 2xl:block">
          <Suspense fallback={<div aria-hidden className="h-target-practice w-96" />}>
            <SpeedPresets value={value} onValueChange={set} label={labels.presets} />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export { SpeedControl }
