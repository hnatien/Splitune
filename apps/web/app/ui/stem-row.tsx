import type { StemKind } from '@splitune/ui-tokens'
import { cn } from '@/lib/utils'
import { NumberField } from '@/ui/number-field'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent } from '@/ui/popover-content'
import { Skeleton } from '@/ui/skeleton'
import { Slider } from '@/ui/slider'
import { Status } from '@/ui/status'
import { Toggle } from '@/ui/toggle'
import { WithTooltip } from '@/ui/tooltip'

// Doc 26 §4.4, §12.2, s47 direction §6: one row per stem. A 4 px rule in the stem's colour runs
// beside its name (colour is never the only cue: the name is always there), "Your part" and
// "Rough" as plain labels after it, then M and S as inverted 48 px letter toggles (on = the ink
// fill, off = a hairline circle) and under them the fader with its readout. The readout says the
// state in words as well as the level: "+6 dB", "Muted", "Not heard" (another stem is soloed),
// "−6 dB · solo". A stem that isn't heard dims its name and readout to faint text, never by
// opacity. A tap on the fader's track sets it and the readout opens a stepper, so nothing needs a
// drag (WCAG 2.5.7). `StemToggle` is the same M/S toggle, for the phone Tools sheet.

const STEM_RULE: Record<StemKind, string> = {
  guitar: 'bg-stem-guitar',
  bass: 'bg-stem-bass',
  drums: 'bg-stem-drums',
  vocals: 'bg-stem-vocals',
  keys: 'bg-stem-keys',
  other: 'bg-stem-other',
  mix: 'bg-stem-mix',
}

/** The fader's fill in the stem's colour, for faders that stand apart from their row's rule. */
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
  /** Another stem is soloed, so this one isn't heard: dims the row and says so. */
  notHeard?: boolean
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
    /** The readout while muted ("Muted"). */
    muted?: string
    /** Added to the level while soloed ("solo": "−6 dB · solo"). */
    soloed?: string
    /** The readout while another stem is soloed ("Not heard"). */
    notHeard?: string
  }
  className?: string
}

function StemToggle({
  pressed,
  onPressedChange,
  label,
  children,
  className,
}: {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  label: string
  children: string
  /** Kept for the screens: the row and the phone Tools sheet both paint the full 48 px circle. */
  size?: 'row' | 'tools'
  className?: string
}) {
  return (
    <Toggle
      variant="invert"
      size="practice"
      pressed={pressed}
      onPressedChange={onPressedChange}
      aria-label={label}
      data-slot="stem-ms"
      className={cn('px-0', className)}
    >
      {children}
    </Toggle>
  )
}

/** What the readout says: the level, or the state in words. Solo wins over mute. */
export function stemReadout(
  {
    gainDb,
    muted,
    soloed,
    notHeard,
  }: Pick<StemRowProps, 'gainDb' | 'muted' | 'soloed' | 'notHeard'>,
  labels: StemRowProps['labels'],
): string {
  if (soloed) return labels.soloed ? `${formatDb(gainDb)} · ${labels.soloed}` : formatDb(gainDb)
  if (muted && labels.muted) return labels.muted
  if (notHeard && labels.notHeard) return labels.notHeard
  return formatDb(gainDb)
}

const ROW =
  'grid grid-cols-[0.25rem_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 py-1.5 pr-1 pl-1'

function StemRow({
  stem,
  name,
  muted,
  soloed,
  onMutedChange,
  onSoloedChange,
  gainDb,
  onGainChange,
  notHeard = false,
  yourPart,
  rough,
  labels,
  className,
}: StemRowProps) {
  const readout = stemReadout({ gainDb, muted, soloed, notHeard }, labels)
  const quiet = (muted && !soloed) || (notHeard && !soloed)
  return (
    <div
      data-slot="stem-row"
      data-stem={stem}
      data-heard={quiet ? 'false' : 'true'}
      className={cn(ROW, className)}
    >
      <span
        aria-hidden
        data-slot="stem-rule"
        className={cn('row-span-2 w-1 self-stretch rounded-full', STEM_RULE[stem])}
      />
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn('truncate text-label', quiet ? 'text-faint-foreground' : 'text-foreground')}
        >
          {name}
        </span>
        {yourPart && (
          <span className="shrink-0 text-caption text-muted-foreground">{yourPart}</span>
        )}
        {rough && (
          <WithTooltip label={rough.reason}>
            <Status kind="attention" tabIndex={0} className="shrink-0 rounded-media">
              {rough.label}
              <span className="sr-only">: {rough.reason}</span>
            </Status>
          </WithTooltip>
        )}
      </span>
      <StemToggle pressed={muted} onPressedChange={onMutedChange} label={`${labels.mute} ${name}`}>
        M
      </StemToggle>
      <StemToggle
        pressed={soloed}
        onPressedChange={onSoloedChange}
        label={`${labels.solo} ${name}`}
      >
        S
      </StemToggle>
      <span className="col-span-3 flex min-w-0 items-center gap-2">
        <Slider
          className="min-w-0 flex-1"
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
            data-slot="stem-readout"
            aria-label={`${labels.volume} ${name}: ${readout}`}
            className={cn(
              'inline-flex min-h-target-practice w-24 shrink-0 items-center justify-end rounded-full px-2 text-body-sm whitespace-nowrap tabular-nums inset-ring inset-ring-transparent hover:bg-hover hover:text-foreground aria-expanded:inset-ring-[1.5px] aria-expanded:inset-ring-selected',
              quiet ? 'text-faint-foreground' : 'text-muted-foreground',
            )}
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
    <div data-slot="stem-row-skeleton" className={cn(ROW, className)}>
      <Skeleton className="row-span-2 w-1 self-stretch rounded-full" />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="size-target-practice rounded-full" />
      <Skeleton className="size-target-practice rounded-full" />
      <Skeleton className="col-span-3 h-target-practice rounded-full" />
    </div>
  )
}

export { STEM_FILL, STEM_RULE, StemRow, StemRowSkeleton, StemToggle }
