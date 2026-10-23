import { cn } from '@/lib/utils'
import { Meter, MeterLabel } from '@/ui/meter'

// Doc 26 §12.2, 23 §5: "4 of 5 Lite analyses left · resets 1 Dec" — the text first, the bar second,
// on a sunken rounded track.

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
      className={cn('max-w-sm **:data-[slot=meter-track]:bg-surface-sunken', className)}
    >
      <MeterLabel className="font-normal text-foreground tabular-nums">{text}</MeterLabel>
    </Meter>
  )
}

export { AllowanceMeter }
