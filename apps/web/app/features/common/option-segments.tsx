import { useId } from 'react'
import { Kbd } from '@/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'

// A labelled choice over two to four options shown at once (loop rests, count-in, display
// appearance). One is always chosen and carries the ink edge
// (26 §4.5), never a grey fill. Options size to their labels and share the spare width, so a long
// label ("Follow system") never spills out; when they don't fit one row they wrap. `shortcut`
// prints the key that steps through the options beside the label.
export function OptionSegments<T extends string>({
  label,
  value,
  options,
  onChange,
  shortcut,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  shortcut?: string | undefined
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2">
        <span id={id} className="text-label-sm text-muted-foreground">
          {label}
        </span>
        {shortcut && <Kbd aria-hidden>{shortcut}</Kbd>}
      </span>
      <ToggleGroup
        aria-labelledby={id}
        aria-keyshortcuts={shortcut}
        className="w-full flex-wrap"
        value={[value]}
        onValueChange={(next) => {
          const picked = next[0]
          if (picked) onChange(picked as T)
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className="flex-auto">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
