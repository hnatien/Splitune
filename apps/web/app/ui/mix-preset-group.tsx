import { CheckIcon } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'

// Doc 26 §12.2, 27 §5.2: "Your part loud", "Minus-one", "Original". One is always selected; the
// pressed preset shows a check, not just the accent fill.

export type MixPreset = 'part-loud' | 'minus-one' | 'original'

type MixPresetGroupProps = {
  value: MixPreset | null
  onValueChange: (value: MixPreset) => void
  options: { value: MixPreset; label: string }[]
  /** Group name, e.g. "Mix". */
  label: string
  className?: string
}

function MixPresetGroup({ value, onValueChange, options, label, className }: MixPresetGroupProps) {
  return (
    <ToggleGroup
      aria-label={label}
      size="practice-2"
      value={value ? [value] : []}
      onValueChange={(next) => {
        const preset = next[0] as MixPreset | undefined
        if (preset) onValueChange(preset)
      }}
      className={className}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {value === option.value && <CheckIcon aria-hidden />}
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export { MixPresetGroup }
