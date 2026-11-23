import { Meter as MeterPrimitive } from '@base-ui/react/meter'
import { cn } from '@/lib/utils'

/**
 * A measurement within a known range (allowance used, stem level): a track edged in `--edge`, so
 * an empty meter still shows its range (1.4.11), with a --muted-foreground fill. It is not task
 * progress, so it isn't the ink (26 §4.5). The value is always in words beside it, so the fill
 * never carries the number alone.
 */
function Meter({ className, children, ...props }: MeterPrimitive.Root.Props) {
  return (
    <MeterPrimitive.Root
      data-slot="meter"
      className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-2', className)}
      {...props}
    >
      {children}
      <MeterPrimitive.Track
        data-slot="meter-track"
        className="relative h-1.5 w-full overflow-hidden rounded-full inset-ring inset-ring-edge"
      >
        <MeterPrimitive.Indicator
          data-slot="meter-indicator"
          className="h-full rounded-full bg-muted-foreground"
        />
      </MeterPrimitive.Track>
    </MeterPrimitive.Root>
  )
}

function MeterLabel({ className, ...props }: MeterPrimitive.Label.Props) {
  return (
    <MeterPrimitive.Label
      data-slot="meter-label"
      className={cn('text-label-sm', className)}
      {...props}
    />
  )
}

/** The value in the text face ("12 of 15 left · resets 22 Nov" reads as a sentence); tabular figures. */
function MeterValue({ className, ...props }: MeterPrimitive.Value.Props) {
  return (
    <MeterPrimitive.Value
      data-slot="meter-value"
      className={cn('ml-auto text-body-sm text-muted-foreground tabular-nums', className)}
      {...props}
    />
  )
}

export { Meter, MeterLabel, MeterValue }
