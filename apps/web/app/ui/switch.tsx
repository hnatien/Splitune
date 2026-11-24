import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '@/lib/utils'

/**
 * `.toggle` (doc 26 §12.1): a 40 × 24 track painted inside a 48 × 44 box (the box is the target,
 * §8; in a label row the whole row is). Off is an --edge track (≥ 3:1) with the knob on the left;
 * on inverts it to the ink with the knob on the right, so position and inversion both carry the
 * state. Disabled drops the fill: an --edge outline and a faint knob.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer group/switch relative inline-flex h-11 w-12 shrink-0 items-center rounded-full border-x-4 border-y-10 border-transparent bg-edge bg-clip-padding py-0.75 pr-0.5 pl-1 inset-ring inset-ring-edge transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard focus-visible:outline-offset-0 aria-invalid:inset-ring-destructive data-checked:bg-primary data-checked:inset-ring-primary data-disabled:cursor-not-allowed data-disabled:bg-transparent data-disabled:inset-ring-edge',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-background transition-transform duration-(--duration-fast) ease-standard data-checked:translate-x-4 group-data-disabled/switch:bg-faint-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
