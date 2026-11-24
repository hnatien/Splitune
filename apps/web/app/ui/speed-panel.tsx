import type * as React from 'react'
import { useRef, useState } from 'react'
import { NumberField } from '@/ui/number-field'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { SPEED_FINE_STEP } from '@/ui/speed-control'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'

// SpeedControl's panel (doc 26 §12.2, s47 direction §7): the presets 50 · 60 · 70 · 75 · 80 · 90 ·
// 100 as pills (the current one has the ink edge), a typed field focused on open, and the speed
// ladder's goal in words while it is on. The presets alone may also sit inline in the transport
// from `2xl` (tablets).

export const SPEED_PRESETS = [50, 60, 70, 75, 80, 90, 100] as const

const NBSP = '\u00a0'

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
      size="practice"
      value={SPEED_PRESETS.includes(value as (typeof SPEED_PRESETS)[number]) ? [String(value)] : []}
      onValueChange={(next) => {
        const preset = next[0]
        if (preset !== undefined) onValueChange(Number(preset))
      }}
      className={className}
    >
      {SPEED_PRESETS.map((preset) => (
        <ToggleGroupItem key={preset} value={String(preset)} className="px-2 tabular-nums">
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
  onDone,
  fieldRef,
}: {
  value: number
  min: number
  max: number
  onValueChange: (value: number) => void
  labels: {
    speed: string
    presets: string
    /** The typed field's name; `speed` when omitted. */
    field?: string
    decrease?: string
    increase?: string
  }
  /** "ladder goal 100 %" while the speed ladder is on. */
  goal?: string | undefined
  /** A typed speed was set with Enter: the panel's work is done (SpeedControl closes it). */
  onDone?: () => void
  /** The typed field, for the control to select its text once the panel has opened. */
  fieldRef?: React.RefObject<HTMLInputElement | null>
}) {
  const field = useRef<HTMLInputElement>(null)
  // The field keeps what is being typed and sets the speed when it is committed (Enter, blur, a
  // step), so typing "65" never passes through 50 % on the way.
  const [draft, setDraft] = useState<number | null>(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
  }
  return (
    <PopoverContent
      side="top"
      aria-label={labels.speed}
      // The typed field takes focus with its text selected, so "70" and Enter replace the speed.
      initialFocus={() => field.current ?? true}
      className="w-auto max-w-[min(22rem,calc(100vw-2rem))] gap-3"
    >
      <PopoverTitle className="text-label">{labels.speed}</PopoverTitle>
      <SpeedPresets
        value={value}
        onValueChange={onValueChange}
        label={labels.presets}
        className="grid w-full grid-cols-4"
      />
      {/* The wrapper finds the visible field: NumberField's own `inputRef` is its hidden form input. */}
      <div
        ref={(node) => {
          const input = node?.querySelector<HTMLInputElement>('input[aria-label]') ?? null
          field.current = input
          if (fieldRef) fieldRef.current = input
        }}
      >
        <NumberField
          value={draft}
          min={min}
          max={max}
          step={SPEED_FINE_STEP}
          largeStep={10}
          onValueChange={setDraft}
          onValueCommitted={(next) => next !== null && onValueChange(next)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || draft === null) return
            onValueChange(draft)
            onDone?.()
          }}
          unit="%"
          inputLabel={labels.field ?? labels.speed}
          decrementLabel={labels.decrease ?? labels.speed}
          incrementLabel={labels.increase ?? labels.speed}
          fill
        />
      </div>
      {goal && (
        <p className="text-body-sm text-muted-foreground first-letter:uppercase tabular-nums">
          {goal}
        </p>
      )}
    </PopoverContent>
  )
}
