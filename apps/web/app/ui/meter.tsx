import { Meter as MeterPrimitive } from '@base-ui/react/meter'
import { cn } from '@/lib/utils'

/**
 * A measurement within a known range (allowance used, stem level), drawn like `.bar` (doc 26
 * §12.1) with a --muted-foreground fill: it is not task progress, so it isn't amber (§4.5).
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
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-accent in-data-[slot=card]:h-1"
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
      className={cn('text-sm font-semibold', className)}
      {...props}
    />
  )
}

function MeterValue({ className, ...props }: MeterPrimitive.Value.Props) {
  return (
    <MeterPrimitive.Value
      data-slot="meter-value"
      className={cn('ml-auto font-mono text-sm text-muted-foreground tabular-nums', className)}
      {...props}
    />
  )
}

export { Meter, MeterLabel, MeterValue }
