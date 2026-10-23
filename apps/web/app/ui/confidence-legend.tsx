import { InfoIcon } from 'lucide-react'
import { lazy, Suspense, useId } from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { Switch } from '@/ui/switch'

// Doc 26 §5: the "Auto-transcribed — may contain errors (v{model})" legend with the "Show
// uncertainty" switch, and a key for the dashed box and "?" so the marks are explained. On the
// practice screen ConfidenceLegendPopover keeps it one tap away behind an always-visible dashed
// chip ("Auto-transcribed · v0.4.0"; its icon alone below `md`); the popover's contents load on
// first open (12 §10 route budget).

const LegendPanel = lazy(() =>
  import('./confidence-legend-panel').then((module) => ({ default: module.ConfidenceLegendPanel })),
)

type ConfidenceLegendProps = {
  /** Catalogue `practice.legend`, already formatted with the model version. */
  text: string
  labels: {
    showUncertainty: string
    /** Names for the medium and low marks, e.g. "Probably" and "Unsure". */
    medium: string
    low: string
  }
  showUncertainty: boolean
  onShowUncertaintyChange: (show: boolean) => void
  className?: string
}

function ConfidenceLegend({
  text,
  labels,
  showUncertainty,
  onShowUncertaintyChange,
  className,
}: ConfidenceLegendProps) {
  const switchId = useId()
  return (
    <div
      data-slot="confidence-legend"
      className={cn(
        'inline-flex w-fit flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-2 text-sm text-foreground',
        className,
      )}
    >
      <span className="font-medium">{text}</span>
      {showUncertainty && (
        <span className="inline-flex items-center gap-3 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-5 rounded-sm border border-dashed border-input"
            />
            {labels.medium}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-grid size-5 place-items-center rounded-sm border border-dashed border-input text-xs font-bold leading-none"
            >
              ?
            </span>
            {labels.low}
          </span>
        </span>
      )}
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
  /** Catalogue `practice.legend_short`, e.g. "Auto-transcribed · v0.4.0". */
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
              'inline-flex min-h-target min-w-target shrink-0 items-center justify-center gap-2 rounded-full border-[1.5px] border-dashed border-input px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
              className,
            )}
          />
        }
      >
        <InfoIcon aria-hidden className="size-4 shrink-0" />
        <span className="max-md:sr-only">{buttonLabel}</span>
      </PopoverTrigger>
      <Suspense fallback={null}>
        <LegendPanel {...legend} />
      </Suspense>
    </Popover>
  )
}

export type { ConfidenceLegendProps }
export { ConfidenceLegend, ConfidenceLegendPopover }
