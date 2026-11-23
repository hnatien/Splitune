import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { cn } from '@/lib/utils'

// Add song's part chips (27 §3.6): pill radios painted 36 px inside a 44 px target. Checked = the
// ink wash with an ink-line edge and foreground text (26 §12.3: the fill and edge are the cue,
// never colour alone).

export function ChipRadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      className={cn('flex flex-wrap gap-x-0.5 gap-y-1 [&>input]:absolute', className)}
      {...props}
    />
  )
}

export function ChipRadio({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      className={cn(
        'relative inline-flex min-h-target cursor-pointer items-center gap-1.5 rounded-full border-4 border-transparent bg-clip-padding px-3 text-label font-medium text-muted-foreground inset-ring inset-ring-border-strong transition-colors duration-(--duration-fast) hover:bg-panel hover:text-foreground focus-visible:outline-offset-[-2px] data-checked:bg-wash data-checked:text-foreground data-checked:inset-ring-selected data-checked:hover:bg-wash data-disabled:cursor-not-allowed data-disabled:bg-panel data-disabled:text-faint-foreground forced-colors:data-checked:outline-2 forced-colors:data-checked:outline-solid',
        className,
      )}
      {...props}
    />
  )
}
