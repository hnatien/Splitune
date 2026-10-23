import { STEMS, type StemKind } from '@splitune/ui-tokens'
import {
  AudioWaveformIcon,
  DrumIcon,
  GuitarIcon,
  type LucideIcon,
  MicIcon,
  PianoIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { NumberField } from '@/ui/number-field'
import { Skeleton } from '@/ui/skeleton'
import { Slider } from '@/ui/slider'
import { Toggle } from '@/ui/toggle'
import { WithTooltip } from '@/ui/tooltip'

// Doc 26 §4.4, §12.2: a raised card per stem with label + icon + colour rule (colour is never the
// only cue), M/S toggles, fader paired with a dB field (WCAG 2.5.7), "Your part" tag with a 2 px
// left rule, rough-stem warning with its reason, and a loading skeleton with the same layout.

const ICONS: Record<(typeof STEMS)[StemKind]['icon'], LucideIcon> = {
  guitar: GuitarIcon,
  drum: DrumIcon,
  mic: MicIcon,
  piano: PianoIcon,
  'audio-waveform': AudioWaveformIcon,
}

const RULE: Record<StemKind, string> = {
  guitar: 'bg-stem-guitar',
  bass: 'bg-stem-bass',
  drums: 'bg-stem-drums',
  vocals: 'bg-stem-vocals',
  keys: 'bg-stem-keys',
  other: 'bg-stem-other',
  mix: 'bg-stem-mix',
}

export const GAIN_RANGE = { min: -30, max: 6 } as const

type StemRowProps = {
  stem: StemKind
  /** Instrument name shown in the row, e.g. "Guitar". */
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
  }
  className?: string
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
  const Icon = ICONS[STEMS[stem].icon]
  return (
    <div
      data-slot="stem-row"
      data-stem={stem}
      className={cn(
        'grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-xl border-l-2 bg-surface-raised p-3 shadow-1 sm:grid-cols-[16rem_auto_1fr_auto]',
        yourPart ? 'border-foreground' : 'border-transparent',
        className,
      )}
    >
      <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
        <span aria-hidden className={cn('h-8 w-1.5 shrink-0 rounded-full', RULE[stem])} />
        <Icon aria-hidden className="size-6 shrink-0" />
        <span className="truncate text-base font-semibold">{name}</span>
        {yourPart && <Badge variant="primary">{yourPart}</Badge>}
        {rough && (
          <WithTooltip label={rough.reason}>
            <Badge variant="warning" tabIndex={0} render={<span />}>
              <TriangleAlertIcon aria-hidden />
              {rough.label}
              <span className="sr-only">: {rough.reason}</span>
            </Badge>
          </WithTooltip>
        )}
      </div>
      <div className="flex gap-2">
        <Toggle
          size="practice-2"
          pressed={muted}
          onPressedChange={onMutedChange}
          aria-label={`${labels.mute} ${name}`}
        >
          M
        </Toggle>
        <Toggle
          size="practice-2"
          pressed={soloed}
          onPressedChange={onSoloedChange}
          aria-label={`${labels.solo} ${name}`}
        >
          S
        </Toggle>
      </div>
      <Slider
        value={gainDb}
        min={GAIN_RANGE.min}
        max={GAIN_RANGE.max}
        step={1}
        largeStep={6}
        onValueChange={(next) => onGainChange(Array.isArray(next) ? (next[0] ?? gainDb) : next)}
        thumbLabels={[`${labels.volume} ${name}`]}
      />
      <NumberField
        className="col-span-2 sm:col-span-1"
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
    </div>
  )
}

/** Placeholder with the row's layout while stems load (no layout shift when they arrive). */
function StemRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="stem-row-skeleton"
      className={cn(
        'grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-xl border-l-2 border-transparent bg-surface-raised p-3 shadow-1 sm:grid-cols-[16rem_auto_1fr_auto]',
        className,
      )}
    >
      <Skeleton className="col-span-2 h-8 w-40 sm:col-span-1" />
      <div className="flex gap-2">
        <Skeleton className="size-target-practice-2" />
        <Skeleton className="size-target-practice-2" />
      </div>
      <Skeleton className="h-2" />
      <Skeleton className="col-span-2 h-11 w-44 sm:col-span-1" />
    </div>
  )
}

export { StemRow, StemRowSkeleton }
