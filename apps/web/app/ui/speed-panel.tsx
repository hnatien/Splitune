import { PopoverContent } from '@/ui/popover-content'
import { Slider } from '@/ui/slider'
import { SPEED_FINE_STEP } from '@/ui/speed-control'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'

// SpeedControl's popover (doc 26 §12.2): the slider and the presets 50 · 60 · 70 · 75 · 80 · 90 · 100
// as a segmented group (`.seg`), and the speed ladder's goal in words while it is on. The presets
// alone may also sit inline in the transport bar from `2xl` (tablets until s43; the desktop dock
// has no room for them).

export const SPEED_PRESETS = [50, 60, 70, 75, 80, 90, 100] as const

const NBSP = ' '

export function SpeedPresets({
  value,
  onValueChange,
  label,
  className,
}: {
  value: number
  onValueChange: (value: number) => void
  label: string
  className?: string
}) {
  return (
    <ToggleGroup
      aria-label={label}
      size="practice-2"
      value={SPEED_PRESETS.includes(value as (typeof SPEED_PRESETS)[number]) ? [String(value)] : []}
      onValueChange={(next) => {
        const preset = next[0]
        if (preset !== undefined) onValueChange(Number(preset))
      }}
      className={className}
    >
      {SPEED_PRESETS.map((preset) => (
        <ToggleGroupItem
          key={preset}
          value={String(preset)}
          className="min-w-12 flex-1 px-1.5 font-mono tabular-nums"
        >
          {preset}
          {NBSP}%
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function SpeedPanel({
  value,
  min,
  max,
  onValueChange,
  labels,
  goal,
}: {
  value: number
  min: number
  max: number
  onValueChange: (value: number) => void
  labels: { speed: string; presets: string }
  /** "ladder goal 100 %" while the speed ladder is on. */
  goal?: string | undefined
}) {
  return (
    <PopoverContent
      side="top"
      aria-label={labels.speed}
      className="w-auto max-w-[min(32rem,100vw)] gap-4"
    >
      <Slider
        value={value}
        min={min}
        max={max}
        step={SPEED_FINE_STEP}
        onValueChange={(next) => onValueChange(Array.isArray(next) ? (next[0] ?? value) : next)}
        thumbLabels={[labels.speed]}
      />
      <SpeedPresets
        value={value}
        onValueChange={onValueChange}
        label={labels.presets}
        className="w-full justify-between"
      />
      {goal && (
        <p className="text-sm text-muted-foreground first-letter:uppercase tabular-nums">{goal}</p>
      )}
    </PopoverContent>
  )
}
