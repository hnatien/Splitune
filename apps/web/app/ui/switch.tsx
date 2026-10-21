import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '@/lib/utils'

/** 44 × 24 track with a 44 px tall hit area; the thumb position carries the state. */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer group/switch relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-input p-0.5 transition-colors after:absolute after:top-1/2 after:left-1/2 after:h-target after:w-full after:-translate-1/2 aria-invalid:border-destructive data-checked:border-primary data-checked:bg-primary data-unchecked:bg-muted data-disabled:cursor-not-allowed data-disabled:border-input data-disabled:bg-muted',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4.5 rounded-full border border-input bg-card transition-transform duration-(--duration-fast) data-checked:translate-x-5 data-checked:border-primary-foreground data-checked:bg-primary-foreground data-unchecked:translate-x-0 group-data-disabled/switch:bg-muted-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
