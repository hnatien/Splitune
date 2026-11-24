import { ChoiceRow, ChoiceRowGroup } from '@/ui/choice-row'

// The three appearances (26 §2, D2; Settings-Display) as choice rows (26 §12.1): a small themed
// swatch, the name and its hint; the chosen row has the ink edge and a check. Each swatch is a
// subtree carrying `data-appearance`, so it paints that theme's own tokens (never raw colours);
// "Follow my device" shows both halves.

type Choice = 'dark' | 'light' | 'system'

function Swatch({ appearance }: { appearance: Choice }) {
  const half = (theme: 'dark' | 'light') => (
    <span data-appearance={theme} className="flex flex-1 items-center bg-background px-1.5">
      <span className="h-0.5 w-full rounded-full bg-foreground" />
    </span>
  )
  return (
    <span aria-hidden className="flex h-8 w-12 overflow-hidden rounded-media border border-edge">
      {appearance === 'system' ? (
        <>
          {half('dark')}
          {half('light')}
        </>
      ) : (
        half(appearance)
      )}
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
    <ChoiceRowGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => void onChange(next as Choice)}
    >
      {options.map((option) => (
        <ChoiceRow
          key={option.value}
          value={option.value}
          icon={<Swatch appearance={option.value} />}
          label={option.label}
          description={option.hint}
        />
      ))}
    </ChoiceRowGroup>
  )
}
