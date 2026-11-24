import { cn } from '@/lib/utils'
import { ChoiceRow, ChoiceRowGroup } from '@/ui/choice-row'

// Doc 26 §12.2, 27 §3.7.4, s47 direction §8 (MixPresetList): "Your part loud", "Minus-one",
// "Original" and "Rhythm only" (when bass and drums are stems of their own) as a list of rows,
// each with its name and a gloss line ("Guitar +6 dB, the band −6 dB"). The chosen row has the
// 1.5 px ink edge and a check; none is chosen when the mix matches no preset.

export type MixPreset = 'part-loud' | 'minus-one' | 'original' | 'rhythm'

type MixPresetGroupProps = {
  value: MixPreset | null
  onValueChange: (value: MixPreset) => void
  options: { value: MixPreset; label: string; gloss: string }[]
  /** Group name, e.g. "Mix presets". */
  label: string
  /** Kept for the screens: the presets are always one row each now. */
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

function MixPresetGroup({ value, onValueChange, options, label, className }: MixPresetGroupProps) {
  return (
    <ChoiceRowGroup
      aria-label={label}
      data-slot="mix-preset-group"
      value={value ?? ''}
      onValueChange={(next) => {
        if (next) onValueChange(next as MixPreset)
      }}
      className={cn('gap-0.5', className)}
    >
      {options.map((option) => (
        <ChoiceRow
          key={option.value}
          size="sm"
          value={option.value}
          data-slot="mix-preset"
          label={option.label}
          description={option.gloss}
        />
      ))}
    </ChoiceRowGroup>
  )
}

/** The direction's name for the list (s47 §8); the same component. */
const MixPresetList = MixPresetGroup

export { MixPresetGroup, MixPresetList }
