import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { useId } from 'react'
import { cn } from '@/lib/utils'

// The three appearance cards (26 §2, D2; Settings-Display): a themed miniature over the name and
// its hint. Each miniature is a subtree carrying `data-appearance`, so it paints that theme's own
// tokens (never raw colours); "Follow my device" shows both halves. Checked = the radio-card edge
// (1 px --signal border + 1 px inset ring, 26 §12.3), so the state never rests on colour alone.

type Choice = 'dark' | 'light' | 'system'

// Sample data in a decorative miniature, not copy (27 "Mockups").
const MINIATURE_CHORD = 'C'

function Miniature({ appearance }: { appearance: 'dark' | 'light' }) {
  return (
    <span
      data-appearance={appearance}
      className="flex h-full flex-1 items-center gap-2.5 bg-background px-3.5 text-foreground"
    >
      <span className="text-3xl font-semibold">{MINIATURE_CHORD}</span>
      <span className="flex h-10 flex-1 flex-col justify-between">
        {[0, 1, 2, 3, 4].map((line) => (
          <span key={line} className="h-px bg-staff" />
        ))}
      </span>
      <span className="size-4.5 rounded-full bg-primary" />
    </span>
  )
}

export function AppearanceCards({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Choice
  options: { value: Choice; label: string; hint: string }[]
  onChange: (value: Choice) => unknown
}) {
  return (
    <RadioGroupPrimitive
      aria-label={label}
      value={value}
      onValueChange={(next) => void onChange(next as Choice)}
      className="grid grid-cols-[repeat(auto-fit,minmax(min(13.75rem,100%),1fr))] gap-3"
    >
      {options.map((option) => (
        <AppearanceCard key={option.value} {...option} />
      ))}
    </RadioGroupPrimitive>
  )
}

function AppearanceCard({ value, label, hint }: { value: Choice; label: string; hint: string }) {
  const labelId = useId()
  const hintId = useId()
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Base UI's Radio renders the control inside
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-2.5 rounded-3xl border border-border bg-card p-3 pointer-fine:hover:bg-muted contrast-more:border-input',
        'has-data-checked:border-signal has-data-checked:inset-ring has-data-checked:inset-ring-signal',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
        'forced-colors:has-data-checked:outline-2 forced-colors:has-data-checked:outline-solid',
      )}
    >
      <span aria-hidden className="flex h-21 overflow-hidden rounded-xl border border-border">
        {value === 'system' ? (
          <>
            <span data-appearance="dark" className="flex-1 bg-background" />
            <span data-appearance="light" className="flex-1 bg-background" />
          </>
        ) : (
          <Miniature appearance={value} />
        )}
      </span>
      <RadioPrimitive.Root
        value={value}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="sr-only"
      />
      <span className="flex min-w-0 flex-col">
        <span id={labelId} className="text-base font-semibold">
          {label}
        </span>
        <span id={hintId} className="text-sm text-faint-foreground">
          {hint}
        </span>
      </span>
    </label>
  )
}
