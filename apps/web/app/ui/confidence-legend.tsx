import { lazy, Suspense, useId } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { Switch } from '@/ui/switch'

// Doc 26 §5: always-visible "Auto-transcribed — may contain errors (v{model})" chip with the
// "Show uncertainty" switch, and a key for the dashed box and "?" so the marks are explained.
// Below `lg` the strip has no room for it, so ConfidenceLegendPopover opens the same legend from
// a button; the popover's contents load on first open (12 §10 route budget).

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
  /** Catalogue `practice.legend_button`, e.g. "What do the dashes mean?". */
  buttonLabel: string
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="practice-2" className={className} />}>
        {buttonLabel}
      </PopoverTrigger>
      <Suspense fallback={null}>
        <LegendPanel {...legend} />
      </Suspense>
    </Popover>
  )
}

export type { ConfidenceLegendProps }
export { ConfidenceLegend, ConfidenceLegendPopover }
