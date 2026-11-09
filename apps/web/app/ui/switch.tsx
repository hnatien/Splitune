import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '@/lib/utils'

/**
 * `.toggle` (doc 26 §12.1): a 40 × 24 track painted inside a 48 × 44 box (the box is the target,
 * §8; in a label row the whole row is). Off: --accent track, --input edge, --muted-foreground
 * knob. On: --primary track with a 1 px --signal edge (V16) and a --primary-foreground knob. The
 * knob's position carries the state.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer group/switch relative inline-flex h-11 w-12 shrink-0 items-center rounded-full border-x-4 border-y-10 border-transparent bg-accent bg-clip-padding py-0.75 pr-0.5 pl-1 inset-ring inset-ring-input transition-[background-color,box-shadow] duration-(--duration-fast) focus-visible:outline-offset-0 aria-invalid:inset-ring-destructive data-checked:bg-primary data-checked:inset-ring-signal data-disabled:cursor-not-allowed data-disabled:bg-muted data-disabled:inset-ring-input',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-muted-foreground transition-transform duration-(--duration-fast) data-checked:translate-x-4 data-checked:bg-primary-foreground group-data-disabled/switch:bg-faint-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
