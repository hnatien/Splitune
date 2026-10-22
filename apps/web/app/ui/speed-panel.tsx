import { PopoverContent } from '@/ui/popover-content'
import { Slider } from '@/ui/slider'
import { SPEED_FINE_STEP } from '@/ui/speed-control'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'

// SpeedControl's popover (doc 26 §12.2): the slider and the 50/70/85/100 presets.

export const SPEED_PRESETS = [50, 70, 85, 100] as const

const NBSP = ' '

export function SpeedPanel({
  value,
  min,
  max,
  onValueChange,
  labels,
}: {
  value: number
  min: number
  max: number
  onValueChange: (value: number) => void
  labels: { speed: string; presets: string }
}) {
  return (
    <PopoverContent side="top" className="w-96 gap-4">
      <Slider
        value={value}
        min={min}
        max={max}
        step={SPEED_FINE_STEP}
        onValueChange={(next) => onValueChange(Array.isArray(next) ? (next[0] ?? value) : next)}
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
          if (preset !== undefined) onValueChange(Number(preset))
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
  )
}
