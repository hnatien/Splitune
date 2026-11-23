import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { cn } from '@/lib/utils'

// Doc 26 §12.2, 27 §3.7.4, §5.2 (Practice-Mix.dc.html): "Your part loud", "Minus-one", "Original"
// and "Rhythm only" (when bass and drums are stems of their own) as a 2 × 2 grid of radio cards,
// each with its name and a gloss line ("Learn it: guitar up, band down"). Checked = --wash
// fill, a 1 px --signal border plus a 1 px inset --signal ring (a 2 px edge, never colour alone)
// and --foreground on the name. None is checked when the mix matches no preset. `list` stacks
// them for the narrow phone drawer.

export type MixPreset = 'part-loud' | 'minus-one' | 'original' | 'rhythm'

type MixPresetGroupProps = {
  value: MixPreset | null
  onValueChange: (value: MixPreset) => void
  options: { value: MixPreset; label: string; gloss: string }[]
  /** Group name, e.g. "Mix". */
  label: string
  /** Vertical: one card per row, for narrow panels like the phone drawer. */
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

function MixPresetGroup({
  value,
  onValueChange,
  options,
  label,
  orientation = 'horizontal',
  className,
}: MixPresetGroupProps) {
  return (
    <RadioGroupPrimitive
      aria-label={label}
      data-slot="mix-preset-group"
      value={value ?? ''}
      onValueChange={(next) => {
        if (next) onValueChange(next as MixPreset)
      }}
      className={cn(
        'grid gap-2',
        orientation === 'horizontal' ? 'grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {options.map((option) => (
        <RadioPrimitive.Root
          key={option.value}
          value={option.value}
          data-slot="mix-preset"
          className="group/preset flex min-h-target-practice cursor-pointer flex-col items-start rounded-field border border-border bg-raised px-3 py-2.5 text-left transition-colors duration-(--duration-fast) hover:bg-panel data-checked:border-signal data-checked:bg-wash data-checked:inset-ring data-checked:inset-ring-signal forced-colors:data-checked:bg-raised forced-colors:data-checked:outline-2 forced-colors:data-checked:outline-signal forced-colors:data-checked:outline-solid"
        >
          <span className="text-label font-medium group-data-checked/preset:text-foreground">
            {option.label}
          </span>
          <span className="text-body-sm text-faint-foreground group-data-checked/preset:text-muted-foreground">
            {option.gloss}
          </span>
        </RadioPrimitive.Root>
      ))}
    </RadioGroupPrimitive>
  )
}

export { MixPresetGroup }
