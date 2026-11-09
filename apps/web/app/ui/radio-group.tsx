import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { cn } from '@/lib/utils'

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('grid w-full gap-3', className)}
      {...props}
    />
  )
}

/**
 * `.check` as a radio (doc 26 §12.1): an 18 px ring (--input edge) painted in the middle of a
 * 44 px target box; selected fills it with --signal around a --primary-foreground dot.
 */
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        'group/radio-group-item peer relative grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-offset-[-11px] data-disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <span className="grid size-4.5 place-items-center rounded-full bg-background inset-ring inset-ring-input transition-colors group-aria-invalid/radio-group-item:inset-ring-destructive group-data-checked/radio-group-item:bg-signal group-data-checked/radio-group-item:inset-ring-signal group-data-disabled/radio-group-item:bg-muted group-data-disabled/radio-group-item:inset-ring-input">
        <RadioPrimitive.Indicator data-slot="radio-group-indicator" className="grid">
          <span className="size-2 rounded-full bg-primary-foreground group-data-disabled/radio-group-item:bg-faint-foreground" />
        </RadioPrimitive.Indicator>
      </span>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
