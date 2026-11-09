import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import type { StemKind } from '@splitune/ui-tokens'
import { TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { NumberField } from '@/ui/number-field'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent } from '@/ui/popover-content'
import { Skeleton } from '@/ui/skeleton'
import { Slider } from '@/ui/slider'
import { WithTooltip } from '@/ui/tooltip'

// Doc 26 §4.4, §12.2 (Practice-Mix.dc.html): one row per stem — a 6 × 34 colour rule (colour is
// never the only cue: the name is always there), the name with "Your part" and "Rough" badges, M/S
// painted 32 inside 48 × 48 boxes (on = amber fill, off = outlined), and the fader in the stem's
// colour with its dB readout (mono 13; "muted" while muted). A tap on the fader's track sets it
// and the readout opens a stepper, so nothing needs a drag (WCAG 2.5.7).

const RULE: Record<StemKind, string> = {
  guitar: 'bg-stem-guitar',
  bass: 'bg-stem-bass',
  drums: 'bg-stem-drums',
  vocals: 'bg-stem-vocals',
  keys: 'bg-stem-keys',
  other: 'bg-stem-other',
  mix: 'bg-stem-mix',
}

const FILL: Record<StemKind, string> = {
  guitar: '[&_[data-slot=slider-range]]:bg-stem-guitar',
  bass: '[&_[data-slot=slider-range]]:bg-stem-bass',
  drums: '[&_[data-slot=slider-range]]:bg-stem-drums',
  vocals: '[&_[data-slot=slider-range]]:bg-stem-vocals',
  keys: '[&_[data-slot=slider-range]]:bg-stem-keys',
  other: '[&_[data-slot=slider-range]]:bg-stem-other',
  mix: '[&_[data-slot=slider-range]]:bg-stem-mix',
}

export const GAIN_RANGE = { min: -30, max: 6 } as const

const NBSP = ' '

/** "−6 dB", "0 dB", "+3 dB" (U+2212 minus, a no-break space before the unit, 27 §5.3). */
export function formatDb(db: number): string {
  const sign = db < 0 ? '−' : db > 0 ? '+' : ''
  return `${sign}${Math.abs(Math.round(db))}${NBSP}dB`
}

type StemRowProps = {
  stem: StemKind
  /** Instrument name shown in the row, e.g. "Guitar"; "Band" for the mix-minus. */
  name: string
  muted: boolean
  soloed: boolean
  onMutedChange: (muted: boolean) => void
  onSoloedChange: (soloed: boolean) => void
  gainDb: number
  onGainChange: (db: number) => void
  /** "Your part" tag text; set only on the learner's part. */
  yourPart?: string | undefined
  /** Rough-stem warning: short label ("Rough") and the reason (catalogue `practice.rough_stem`). */
  rough?: { label: string; reason: string } | undefined
  labels: {
    mute: string
    solo: string
    volume: string
    decrease: string
    increase: string
    /** The readout while muted. */
    muted?: string
  }
  className?: string
}

function MsToggle({
  pressed,
  onPressedChange,
  label,
  children,
}: {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  label: string
  children: string
}) {
  return (
    <TogglePrimitive
      pressed={pressed}
      onPressedChange={onPressedChange}
      aria-label={label}
      data-slot="stem-ms"
      className="group/ms inline-grid size-target-practice-2 shrink-0 place-items-center rounded-lg focus-visible:outline-offset-[-6px]"
    >
      <span className="grid size-8 place-items-center rounded-md border border-border-strong text-xs font-[750] text-muted-foreground transition-colors duration-(--duration-fast) group-hover/ms:text-foreground group-data-pressed/ms:border-transparent group-data-pressed/ms:bg-primary group-data-pressed/ms:text-primary-foreground forced-colors:group-data-pressed/ms:bg-card forced-colors:group-data-pressed/ms:border-signal">
        {children}
      </span>
    </TogglePrimitive>
  )
}

function StemRow({
  stem,
  name,
  muted,
  soloed,
  onMutedChange,
  onSoloedChange,
  gainDb,
  onGainChange,
  yourPart,
  rough,
  labels,
  className,
}: StemRowProps) {
  return (
    <div
      data-slot="stem-row"
      data-stem={stem}
      className={cn(
        'grid grid-cols-[0.375rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 px-1 py-1.5',
        className,
      )}
    >
      <span aria-hidden className={cn('row-span-2 h-8.5 w-1.5 rounded-full', RULE[stem])} />
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="truncate text-md font-semibold">{name}</span>
        {yourPart && <Badge variant="primary">{yourPart}</Badge>}
        {rough && (
          <WithTooltip label={rough.reason}>
            <Badge variant="neutral" tabIndex={0} render={<span />}>
              <TriangleAlertIcon aria-hidden />
              {rough.label}
              <span className="sr-only">: {rough.reason}</span>
            </Badge>
          </WithTooltip>
        )}
      </span>
      <span className="row-span-2 flex gap-1">
        <MsToggle pressed={muted} onPressedChange={onMutedChange} label={`${labels.mute} ${name}`}>
          M
        </MsToggle>
        <MsToggle
          pressed={soloed}
          onPressedChange={onSoloedChange}
          label={`${labels.solo} ${name}`}
        >
          S
        </MsToggle>
      </span>
      <span className="flex min-w-0 items-center gap-2.5">
        <Slider
          className={cn('min-w-0 flex-1', FILL[stem])}
          value={gainDb}
          min={GAIN_RANGE.min}
          max={GAIN_RANGE.max}
          step={1}
          largeStep={6}
          onValueChange={(next) => onGainChange(Array.isArray(next) ? (next[0] ?? gainDb) : next)}
          thumbLabels={[`${labels.volume} ${name}`]}
        />
        <Popover>
          <PopoverTrigger
            aria-label={`${labels.volume} ${name}: ${muted && labels.muted ? labels.muted : formatDb(gainDb)}`}
            className="inline-flex min-h-target-practice-2 w-16 shrink-0 items-center justify-end rounded-lg px-1 font-mono text-sm text-muted-foreground tabular-nums hover:bg-muted hover:text-foreground"
          >
            {muted && labels.muted ? labels.muted : formatDb(gainDb)}
          </PopoverTrigger>
          <PopoverContent side="top" aria-label={`${labels.volume} ${name}`} className="w-auto">
            <NumberField
              value={gainDb}
              min={GAIN_RANGE.min}
              max={GAIN_RANGE.max}
              step={1}
              onValueChange={(next) => next !== null && onGainChange(next)}
              unit="dB"
              inputLabel={`${labels.volume} ${name}`}
              decrementLabel={`${labels.decrease} ${name}`}
              incrementLabel={`${labels.increase} ${name}`}
            />
          </PopoverContent>
        </Popover>
      </span>
    </div>
  )
}

/** Placeholder with the row's layout while stems load (no layout shift when they arrive). */
function StemRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="stem-row-skeleton"
      className={cn(
        'grid grid-cols-[0.375rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 px-1 py-1.5',
        className,
      )}
    >
      <Skeleton className="row-span-2 h-8.5 w-1.5" />
      <Skeleton className="h-5 w-32" />
      <span className="row-span-2 flex gap-1">
        <Skeleton className="size-target-practice-2" />
        <Skeleton className="size-target-practice-2" />
      </span>
      <Skeleton className="h-2" />
    </div>
  )
}

export { StemRow, StemRowSkeleton }
