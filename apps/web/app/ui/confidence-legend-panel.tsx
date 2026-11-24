import { ConfidenceLegend, type ConfidenceLegendProps } from '@/ui/confidence-legend'
import { PopoverContent } from '@/ui/popover-content'

// ConfidenceLegendPopover's contents: the legend, stacked.

export function ConfidenceLegendPanel(props: Omit<ConfidenceLegendProps, 'className'>) {
  return (
    <PopoverContent align="end" aria-label={props.text}>
      <ConfidenceLegend {...props} className="flex-col items-start" />
    </PopoverContent>
  )
}
