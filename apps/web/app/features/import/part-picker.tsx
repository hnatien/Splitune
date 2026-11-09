import { ChevronDownIcon } from 'lucide-react'
import { useId } from 'react'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { stemOf } from '../library/song-tile'
import { CardRadio, CardRadioGroup } from './card-radio'

export type Hand = 'right' | 'left'

const SWATCH = {
  guitar: 'bg-stem-guitar',
  bass: 'bg-stem-bass',
  keys: 'bg-stem-keys',
  drums: 'bg-stem-drums',
  vocals: 'bg-stem-vocals',
  other: 'bg-stem-other',
  mix: 'bg-stem-mix',
} as const

// "Your part" (27 §3.6): six radio cards with the stem swatch the mixer uses (26 §4.4), chips on
// phones, and the Hand button (the profile's handedness; changing it here changes the profile).
// The Tuning button joins it with V12.
export function PartPicker({
  instrument,
  onInstrumentChange,
  hand,
  onHandChange,
  compact,
}: {
  instrument: InstrumentName
  onInstrumentChange: (instrument: InstrumentName) => void
  hand: Hand
  onHandChange: (hand: Hand) => void
  compact: boolean
}) {
  const legend = useId()
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend id={legend} className="mb-2 text-sm font-semibold text-muted-foreground">
        {m['import.your_part']()}
      </legend>
      <CardRadioGroup
        aria-labelledby={legend}
        value={instrument}
        onValueChange={(value) => onInstrumentChange(value as InstrumentName)}
        className={compact ? 'flex flex-wrap gap-1.5' : 'grid-cols-3'}
      >
        {INSTRUMENTS.map((value) =>
          compact ? (
            <CardRadio key={value} value={value} look="chip">
              {instrumentLabel(value)}
            </CardRadio>
          ) : (
            <CardRadio
              key={value}
              value={value}
              className="h-16 flex-col justify-center gap-1 px-2 text-center data-checked:bg-card"
            >
              <span aria-hidden className={`h-1 w-4.5 rounded-xs ${SWATCH[stemOf(value)]}`} />
              <span className="text-md font-[650]">{instrumentLabel(value)}</span>
            </CardRadio>
          ),
        )}
      </CardRadioGroup>
      <div className="mt-1 flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" className="flex-1 justify-between" />}>
            <span>
              <span className="font-medium text-faint-foreground">{m['import.hand']()}</span>{' '}
              {hand === 'left' ? m['import.hand_left']() : m['import.hand_right']()}
            </span>
            <ChevronDownIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuRadioGroup
              value={hand}
              onValueChange={(value) => onHandChange(value as Hand)}
            >
              <DropdownMenuRadioItem value="right">
                {m['import.hand_right']()}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="left">{m['import.hand_left']()}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </fieldset>
  )
}
