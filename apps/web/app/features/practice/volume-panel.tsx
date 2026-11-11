import { m } from '@/lib/i18n'
import { PopoverContent } from '@/ui/popover-content'
import { VolumeFields } from './transport-bar'

// The narrow dock's volume popover (26 §7: below 1280 px the volume leaves the dock), loaded on
// first open so the popover's positioning stays out of the route's JS budget (12 §10).
export function VolumePanel() {
  return (
    <PopoverContent
      side="top"
      align="end"
      aria-label={m['practice.volume']()}
      className="w-auto flex-row items-center gap-2"
    >
      <VolumeFields />
    </PopoverContent>
  )
}
