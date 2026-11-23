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
// painted as 32 px circles inside 48 × 48 boxes (on = ink fill, off = outlined), and the fader in the stem's
// colour with its dB readout (mono 13; "solo" while soloed, "muted" while muted, §12.3). A tap on
// the fader's track sets it and the readout opens a stepper, so nothing needs a drag (WCAG 2.5.7).
// `StemToggle` is the same M/S button; the phone Tools sheet paints it at 44 in its 48 box.

const STEM_RULE: Record<StemKind, string> = {
  guitar: 'bg-stem-guitar',
  bass: 'bg-stem-bass',
  drums: 'bg-stem-drums',
  vocals: 'bg-stem-vocals',
  keys: 'bg-stem-keys',
  other: 'bg-stem-other',
  mix: 'bg-stem-mix',
}

const STEM_FILL: Record<StemKind, string> = {
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
    /** The readout while soloed. */
    soloed?: string
  }
  className?: string
}

// The painted face and the focus ring hugging it (inset by the transparent padding around it).
const FACE = {
  row: { box: 'focus-visible:outline-offset-[-6px]', face: 'size-8 text-caption' },
  tools: { box: 'focus-visible:outline-offset-0', face: 'size-11 text-body-sm' },
} as const

function StemToggle({
  pressed,
  onPressedChange,
  label,
  children,
  size = 'row',
}: {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  label: string
  children: string
  /** Painted size inside the 48 box: 32 in a stem row, 44 in the phone Tools sheet. */
  size?: keyof typeof FACE
}) {
  return (
    <TogglePrimitive
      pressed={pressed}
      onPressedChange={onPressedChange}
      aria-label={label}
      data-slot="stem-ms"
      className={cn(
        'group/ms inline-grid size-target-practice shrink-0 place-items-center rounded-full',
        FACE[size].box,
      )}
    >
      <span
        className={cn(
          'grid place-items-center rounded-full border border-border-strong font-medium text-muted-foreground transition-colors duration-(--duration-fast) group-hover/ms:text-foreground group-data-pressed/ms:border-transparent group-data-pressed/ms:bg-primary group-data-pressed/ms:text-primary-foreground forced-colors:group-data-pressed/ms:bg-raised forced-colors:group-data-pressed/ms:border-signal',
          FACE[size].face,
        )}
      >
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
  // Solo wins over mute (a soloed stem plays even when muted), so the readout says so first.
  const readout =
    soloed && labels.soloed
      ? labels.soloed
      : muted && labels.muted
        ? labels.muted
        : formatDb(gainDb)
  return (
    <div
      data-slot="stem-row"
      data-stem={stem}
      className={cn(
        'grid grid-cols-[0.375rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 px-1 py-1.5',
        className,
      )}
    >
      <span aria-hidden className={cn('row-span-2 h-8.5 w-1.5 rounded-full', STEM_RULE[stem])} />
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="truncate text-label font-medium">{name}</span>
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
        <StemToggle
          pressed={muted}
          onPressedChange={onMutedChange}
          label={`${labels.mute} ${name}`}
        >
          M
        </StemToggle>
        <StemToggle
          pressed={soloed}
          onPressedChange={onSoloedChange}
          label={`${labels.solo} ${name}`}
        >
          S
        </StemToggle>
      </span>
      <span className="flex min-w-0 items-center gap-2.5">
        <Slider
          className={cn('min-w-0 flex-1', STEM_FILL[stem])}
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
            aria-label={`${labels.volume} ${name}: ${readout}`}
            className="inline-flex min-h-target-practice w-16 shrink-0 items-center justify-end rounded-field px-1 text-body-sm text-muted-foreground tabular-nums hover:bg-panel hover:text-foreground"
          >
            {readout}
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
        <Skeleton className="size-target-practice" />
        <Skeleton className="size-target-practice" />
      </span>
      <Skeleton className="h-2" />
    </div>
  )
}

export { STEM_FILL, STEM_RULE, StemRow, StemRowSkeleton, StemToggle }
