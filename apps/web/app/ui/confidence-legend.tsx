import { lazy, Suspense, useId } from 'react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/ui/kbd'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { Switch } from '@/ui/switch'

// Doc 26 §5, §12.2, s47 direction §4: "Auto-transcribed — may contain errors (v{model})", the
// key to the marks, each drawn as the notation draws it with an ink digit (Sure: plain; Probably:
// a dotted box in --conf-medium-edge; Unsure: a dashed box and a "?" in --conf-low-edge; Edited by
// you: a 2 px underline in --edited), how often notes are marked unsure in words ("About 1 in 8
// notes in this song are marked unsure") and the "Show uncertainty" switch; with uncertainty
// hidden the key goes too. No card of its own: it sits in a popover, a panel or the key row. On
// the practice screen ConfidenceLegendPopover keeps it one tap away behind the chip "[?] 6 unsure"
// (a 48 px target; the "?" box alone below `md`) with its key cap; the popover's contents load on
// first open (12 §10 route budget).

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
  'inline-grid h-6 min-w-6 place-items-center rounded-media border-[1.5px] border-transparent px-1 font-reading-mono text-label-sm text-ink tabular-nums'

/** The unsure mark as a sample: an ink digit in a dashed box, the "?" beside it. */
function UnsureSample({ digit }: { digit: string }) {
  return (
    <span
      aria-hidden
      data-slot="legend-unsure"
      className={cn(sample, 'relative border-dashed border-conf-low-edge')}
    >
      {digit}
      <span className="absolute -top-2 -right-2.5 font-sans text-caption font-medium text-conf-low-edge">
        ?
      </span>
    </span>
  )
}

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
        'inline-flex w-fit flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-foreground',
        className,
      )}
    >
      <span className="text-label-sm">{text}</span>
      {showUncertainty && (
        <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
          {labels.high && (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden data-slot="legend-sure" className={sample}>
                5
              </span>
              {labels.high}
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              data-slot="legend-probably"
              className={cn(sample, 'border-dotted border-conf-medium-edge')}
            >
              5
            </span>
            {labels.medium}
          </span>
          <span className="inline-flex items-center gap-2">
            <UnsureSample digit="3" />
            {labels.low}
          </span>
          {labels.edited && (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                data-slot="legend-edited"
                className={cn(
                  sample,
                  'underline decoration-edited decoration-2 underline-offset-3',
                )}
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
  shortcut,
  className,
  ...legend
}: Omit<ConfidenceLegendProps, 'className'> & {
  /** Catalogue `practice.legend_short`, e.g. "6 unsure". */
  buttonLabel: string
  /** The key that shows or hides the marks ("U"), printed as a key cap on fine pointers. */
  shortcut?: string | undefined
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            data-slot="confidence-legend-chip"
            aria-keyshortcuts={shortcut}
            className={cn(
              'group/legend inline-flex min-h-target-practice min-w-target-practice shrink-0 items-center justify-center rounded-full focus-visible:outline-offset-[-6px]',
              className,
            )}
          />
        }
      >
        <span className="inline-flex h-8 items-center gap-2 rounded-full px-2.5 text-label-sm whitespace-nowrap text-muted-foreground inset-ring inset-ring-transparent transition-[color,background-color,box-shadow] duration-(--duration-fast) ease-standard group-hover/legend:bg-hover group-hover/legend:text-foreground group-aria-expanded/legend:text-foreground group-aria-expanded/legend:inset-ring-[1.5px] group-aria-expanded/legend:inset-ring-selected">
          <span
            aria-hidden
            data-slot="legend-chip-mark"
            className="inline-grid size-4.5 place-items-center rounded-media border-[1.5px] border-dashed border-conf-low-edge text-caption font-medium text-conf-low-edge"
          >
            ?
          </span>
          <span className="max-md:sr-only">{buttonLabel}</span>
          {shortcut && (
            <Kbd aria-hidden className="pointer-coarse:hidden">
              {shortcut}
            </Kbd>
          )}
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
