import { useId } from 'react'
import { Label } from '@/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'

// A labelled Select over a fixed list of options (library filters, "Your part", settings).
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  hideLabel = false,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
  hideLabel?: boolean
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      <Select
        items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
        value={value}
        onValueChange={(next) => onChange(next as T)}
      >
        <SelectTrigger aria-labelledby={id} className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
