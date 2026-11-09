import { cn } from '@/lib/utils'
import { Meter, MeterLabel } from '@/ui/meter'

// Doc 26 §12.2, 23 §5: "3 of 5 Lite left · resets 1 Dec" in 13 px faint text over a 4 px bar,
// at least 150 px wide in the app bar (from `lg`); the text never truncates.

type AllowanceMeterProps = {
  left: number
  limit: number
  /** Catalogue `plan.allowance`, formatted. */
  text: string
  className?: string
}

function AllowanceMeter({ left, limit, text, className }: AllowanceMeterProps) {
  return (
    <Meter
      data-slot="allowance-meter"
      value={left}
      min={0}
      max={limit}
      getAriaValueText={() => text}
      className={cn('w-fit min-w-37.5 gap-y-1 **:data-[slot=meter-track]:h-1', className)}
    >
      <MeterLabel className="text-sm font-normal whitespace-nowrap text-faint-foreground tabular-nums">
        {text}
      </MeterLabel>
    </Meter>
  )
}

export { AllowanceMeter }
