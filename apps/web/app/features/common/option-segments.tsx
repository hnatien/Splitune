import { useId } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'

// A labelled segmented choice over two to four options (loop rests, display appearance): the same
// props as OptionSelect, but every option is visible at once. One is always selected.
export function OptionSegments<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-medium">
        {label}
      </span>
      <ToggleGroup
        aria-labelledby={id}
        className="w-full flex-wrap"
        value={[value]}
        onValueChange={(next) => {
          const picked = next[0]
          if (picked) onChange(picked as T)
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className="flex-1 px-3 text-sm">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
