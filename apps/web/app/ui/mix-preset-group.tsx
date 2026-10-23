import { CheckIcon } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'

// Doc 26 §12.2, 27 §5.2: "Your part loud", "Minus-one", "Original". One is always selected; the
// pressed preset shows a check, not just the raised fill, and a gloss line says what it does.

export type MixPreset = 'part-loud' | 'minus-one' | 'original'

type MixPresetGroupProps = {
  value: MixPreset | null
  onValueChange: (value: MixPreset) => void
  options: { value: MixPreset; label: string; gloss: string }[]
  /** Group name, e.g. "Mix". */
  label: string
  /** Vertical: a full-width list, for narrow panels like the mixer drawer. */
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
  const glossId = useId()
  return (
    <div data-slot="mix-preset-group" className="flex flex-col gap-2">
      <ToggleGroup
        aria-label={label}
        aria-describedby={glossId}
        size="practice-2"
        orientation={orientation}
        value={value ? [value] : []}
        onValueChange={(next) => {
          const preset = next[0] as MixPreset | undefined
          if (preset) onValueChange(preset)
        }}
        className={cn(orientation === 'vertical' && 'w-full', className)}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={orientation === 'vertical' ? 'justify-start rounded-xl' : undefined}
          >
            {value === option.value && <CheckIcon aria-hidden />}
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p id={glossId} className="min-h-5 px-1 text-sm text-muted-foreground">
        {options.find((option) => option.value === value)?.gloss}
      </p>
    </div>
  )
}

export { MixPresetGroup }
