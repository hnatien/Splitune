import { m } from '@/lib/i18n'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { LoopTab } from './loop-tab'

// The loop's options behind the loop badge on tablets and phones (12 §5): the Loop tab's body in a
// popover until those layouts get the inspector (s43).
export function LoopPanel() {
  return (
    <PopoverContent align="end" className="max-h-[80dvh] w-[24rem] gap-4 overflow-y-auto">
      <PopoverTitle>{m['practice.loop_options']()}</PopoverTitle>
      <LoopTab />
    </PopoverContent>
  )
}
