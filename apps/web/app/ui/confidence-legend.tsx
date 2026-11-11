import { lazy, Suspense, useId } from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { Switch } from '@/ui/switch'

// Doc 26 §5, §12.2: "Auto-transcribed — may contain errors (v{model})", the key to the marks (Sure,
// Probably, Unsure, Edited by you, each drawn as the notation draws it), how often notes are marked
// unsure in words ("About 1 in 8 notes in this song are marked unsure") and the "Show uncertainty"
// switch; with uncertainty hidden the key goes too. On the practice screen ConfidenceLegendPopover keeps it one tap away behind the dashed
// chip "? Auto-transcribed · 6 unsure" (a secondary practice control, 48 box; the "?" alone below
// `md`); the popover's contents load on first open (12 §10 route budget).

const LegendPanel = lazy(() =>
  import('./confidence-legend-panel').then((module) => ({ default: module.ConfidenceLegendPanel })),
)

type ConfidenceLegendProps = {
  /** Catalogue `practice.legend`, already formatted with the model version. */
  text: string
  labels: {
    showUncertainty: string
    /** Names for the marks, e.g. "Probably" and "Unsure"; Sure and Edited by you are optional. */
    medium: string
    low: string
    high?: string
    edited?: string
  }
  /** "About 1 in 8 notes in this song are marked unsure" (frequency wording, 27 §5.3). */
  frequency?: string | undefined
  showUncertainty: boolean
  onShowUncertaintyChange: (show: boolean) => void
  className?: string
}

const sample =
  'inline-grid min-w-6 place-items-center rounded-xs px-1 font-reading-mono text-sm leading-6 font-semibold'

function ConfidenceLegend({
  text,
  labels,
  frequency,
  showUncertainty,
  onShowUncertaintyChange,
  className,
}: ConfidenceLegendProps) {
  const switchId = useId()
  return (
    <div
      data-slot="confidence-legend"
      className={cn(
        'inline-flex w-fit flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm text-foreground',
        className,
      )}
    >
      <span className="font-semibold">{text}</span>
      {showUncertainty && (
        <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
          {labels.high && (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className={cn(sample, 'text-ink')}>
                5
              </span>
              {labels.high}
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                sample,
                'text-ink',
                'border-[1.5px] border-dashed border-conf-medium-edge',
              )}
            >
              5
            </span>
            {labels.medium}
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                sample,
                'relative',
                'border-[1.5px] border-dashed border-conf-low text-conf-low',
              )}
            >
              3<sup className="absolute -top-2 -right-2 font-sans text-2xs font-bold">?</sup>
            </span>
            {labels.low}
          </span>
          {labels.edited && (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={cn(sample, 'text-edited underline decoration-2 underline-offset-3')}
              >
                2
              </span>
              {labels.edited}
            </span>
          )}
        </span>
      )}
      {frequency && <span className="text-muted-foreground">{frequency}</span>}
      <span className="inline-flex items-center gap-2">
        <Switch id={switchId} checked={showUncertainty} onCheckedChange={onShowUncertaintyChange} />
        <label htmlFor={switchId} className="cursor-pointer select-none">
          {labels.showUncertainty}
        </label>
      </span>
    </div>
  )
}

function ConfidenceLegendPopover({
  buttonLabel,
  className,
  ...legend
}: Omit<ConfidenceLegendProps, 'className'> & {
  /** Catalogue `practice.legend_short`, e.g. "Auto-transcribed · 6 unsure". */
  buttonLabel: string
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            data-slot="confidence-legend-chip"
            className={cn(
              'group/legend inline-flex min-h-target-practice-2 min-w-target-practice-2 shrink-0 items-center justify-center',
              className,
            )}
          />
        }
      >
        <span className="inline-flex h-7.5 items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-(--duration-fast) group-hover/legend:bg-muted group-hover/legend:text-foreground group-aria-expanded/legend:bg-muted">
          <span aria-hidden className="font-mono font-bold text-unsure">
            ?
          </span>
          <span className="max-md:sr-only">{buttonLabel}</span>
        </span>
      </PopoverTrigger>
      <Suspense fallback={null}>
        <LegendPanel {...legend} />
      </Suspense>
    </Popover>
  )
}

export type { ConfidenceLegendProps }
export { ConfidenceLegend, ConfidenceLegendPopover }
