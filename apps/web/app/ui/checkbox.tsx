import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * `.check` (doc 26 §12.1): an 18 px box with a 1 px --edge (≥ 3:1, its only boundary) painted in the
 * middle of a 44 px target box (§8: the control's own box, no pseudo-element extension). The edge
 * turns to the ink on hover. Checked inverts it: the box fills with the ink and carries a check in
 * the page colour, so the state is a shape and not a shade. Disabled keeps the edge, drops any
 * fill and fades the check.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer group/checkbox relative grid size-11 shrink-0 place-items-center rounded-panel focus-visible:outline-offset-[-11px] disabled:cursor-not-allowed data-disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <span
        data-slot="checkbox-box"
        className="grid size-4.5 place-items-center rounded-media bg-background inset-ring inset-ring-edge transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard group-hover/checkbox:inset-ring-foreground group-aria-invalid/checkbox:inset-ring-destructive group-data-checked/checkbox:bg-primary group-data-checked/checkbox:inset-ring-primary group-data-disabled/checkbox:bg-transparent group-data-disabled/checkbox:inset-ring-edge"
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="grid place-content-center text-primary-foreground group-data-disabled/checkbox:text-faint-foreground [&>svg]:size-3.5"
        >
          <CheckIcon aria-hidden strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
