import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * `.check` (doc 26 §12.1): an 18 px box (--input edge) painted in the middle of a 44 px target
 * box (§8: the control's own box, no pseudo-element extension). Checked fills it with --signal
 * and draws a --primary-foreground check, so the state isn't colour alone.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer group/checkbox relative grid size-11 shrink-0 place-items-center rounded-2xl focus-visible:outline-offset-[-11px] disabled:cursor-not-allowed data-disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <span className="grid size-4.5 place-items-center rounded-xs bg-background inset-ring inset-ring-input transition-colors group-aria-invalid/checkbox:inset-ring-destructive group-data-checked/checkbox:bg-signal group-data-checked/checkbox:inset-ring-signal group-data-disabled/checkbox:bg-muted group-data-disabled/checkbox:inset-ring-input">
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
