import { MinusIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { Slider } from '@/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { TransportButton } from '@/ui/transport-button'

// Doc 26 §12.2, 27 §5.3: −/+ steppers (5 %, 1 % with Shift), tap the readout for the slider
// (50–100 %, 25–200 % advanced) and presets 50/70/85/100; readout "70 % · 84 BPM".

export const SPEED_PRESETS = [50, 70, 85, 100] as const
export const SPEED_STEP = 5
export const SPEED_FINE_STEP = 1

type SpeedControlProps = {
  /** Playback rate in percent of the original. */
  value: number
  onValueChange: (value: number) => void
  /** Original tempo; omit when the beat grid is unknown (the readout shows % only). */
  bpm?: number | undefined
  advanced?: boolean
  labels: {
    /** Accessible name of the readout button and slider, e.g. "Speed". */
    speed: string
    decrease: string
    increase: string
    presets: string
  }
  shortcuts?: { decrease?: string; increase?: string }
  className?: string
}

const NBSP = ' '

export function formatSpeed(percent: number, bpm?: number) {
  const pct = `${percent}${NBSP}%`
  return bpm === undefined ? pct : `${pct} · ${Math.round((bpm * percent) / 100)}${NBSP}BPM`
}

function SpeedControl({
  value,
  onValueChange,
  bpm,
  advanced = false,
  labels,
  shortcuts,
  className,
}: SpeedControlProps) {
  const [min, max] = advanced ? [25, 200] : [50, 100]
  const set = (next: number) => onValueChange(Math.min(max, Math.max(min, next)))
  const step = (direction: 1 | -1) => (event: React.MouseEvent) =>
    set(value + direction * (event.shiftKey ? SPEED_FINE_STEP : SPEED_STEP))

  return (
    <div
      data-slot="speed-control"
      className={cn('inline-flex items-center gap-2 rounded-xl bg-muted p-1.5', className)}
    >
      <TransportButton
        icon={<MinusIcon aria-hidden />}
        label={labels.decrease}
        shortcut={shortcuts?.decrease}
        disabled={value <= min}
        onClick={step(-1)}
      />
      <Popover>
        <PopoverTrigger
          aria-label={`${labels.speed}: ${formatSpeed(value, bpm)}`}
          className="flex min-h-target-practice min-w-36 flex-col items-center justify-center rounded-lg px-3 text-center hover:bg-card"
        >
          <span className="font-reading text-read-readout tabular-nums">
            {value}
            {NBSP}%
          </span>
          {bpm !== undefined && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {Math.round((bpm * value) / 100)}
              {NBSP}BPM
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent side="top" className="w-96 gap-4">
          <Slider
            value={value}
            min={min}
            max={max}
            step={SPEED_FINE_STEP}
            onValueChange={(next) => set(Array.isArray(next) ? (next[0] ?? value) : next)}
            thumbLabels={[labels.speed]}
          />
          <ToggleGroup
            aria-label={labels.presets}
            size="practice-2"
            value={
              SPEED_PRESETS.includes(value as (typeof SPEED_PRESETS)[number]) ? [String(value)] : []
            }
            onValueChange={(next) => {
              const preset = next[0]
              if (preset !== undefined) set(Number(preset))
            }}
            className="w-full justify-between"
          >
            {SPEED_PRESETS.map((preset) => (
              <ToggleGroupItem key={preset} value={String(preset)} className="flex-1 tabular-nums">
                {preset}
                {NBSP}%
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PopoverContent>
      </Popover>
      <TransportButton
        icon={<PlusIcon aria-hidden />}
        label={labels.increase}
        shortcut={shortcuts?.increase}
        disabled={value >= max}
        onClick={step(1)}
      />
    </div>
  )
}

export { SpeedControl }
