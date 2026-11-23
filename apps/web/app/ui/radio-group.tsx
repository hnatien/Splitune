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
 * `.check` as a radio (doc 26 §12.1): an 18 px ring with a 1 px --edge painted in the middle of a
 * 44 px target box; the edge turns to the ink on hover. Chosen inverts it: the ink fills the ring
 * around a dot in the page colour. Disabled keeps the edge with no fill. For choices that need a
 * line of description, use ChoiceRow instead.
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
      <span
        data-slot="radio-group-ring"
        className="grid size-4.5 place-items-center rounded-full bg-background inset-ring inset-ring-edge transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard group-hover/radio-group-item:inset-ring-foreground group-aria-invalid/radio-group-item:inset-ring-destructive group-data-checked/radio-group-item:bg-primary group-data-checked/radio-group-item:inset-ring-primary group-data-disabled/radio-group-item:bg-transparent group-data-disabled/radio-group-item:inset-ring-edge"
      >
        <RadioPrimitive.Indicator data-slot="radio-group-indicator" className="grid">
          <span className="size-2 rounded-full bg-primary-foreground group-data-disabled/radio-group-item:bg-faint-foreground" />
        </RadioPrimitive.Indicator>
      </span>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
