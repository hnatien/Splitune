import { ConfidenceLegend, type ConfidenceLegendProps } from '@/ui/confidence-legend'
import { PopoverContent } from '@/ui/popover-content'

// ConfidenceLegendPopover's contents: the legend itself, without its own card.

export function ConfidenceLegendPanel(props: Omit<ConfidenceLegendProps, 'className'>) {
  return (
    <PopoverContent align="end" aria-label={props.text}>
      <ConfidenceLegend {...props} className="flex-col items-start border-0 bg-transparent p-0" />
    </PopoverContent>
  )
}
