import { useId } from 'react'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { ICON_STROKE } from '@/ui/icons/create'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { INSTRUMENT_ICON } from '../library/song-tile'
import { ChipRadio, ChipRadioGroup } from './chip-radio'

export type Hand = 'right' | 'left'

/** Handedness mirrors fretboards and chord shapes, so it only applies to fretted parts. */
const FRETTED: ReadonlySet<InstrumentName> = new Set(['guitar', 'bass'])

// "Your part" (27 §3.6): six chips, each with its instrument icon (26 §11) beside its name, default from the profile. Fretted parts add Hand on the label row (the profile's
// handedness; changing it here changes the profile). The Tuning control joins it with V12.
export function PartPicker({
  instrument,
  onInstrumentChange,
  hand,
  onHandChange,
}: {
  instrument: InstrumentName
  onInstrumentChange: (instrument: InstrumentName) => void
  hand: Hand
  onHandChange: (hand: Hand) => void
}) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-target items-center justify-between gap-3">
        <span id={`${id}-part`} className="text-md font-medium">
          {m['import.your_part']()}
        </span>
        {FRETTED.has(instrument) && (
          <span className="flex items-center gap-2">
            <span id={`${id}-hand`} className="text-sm text-muted-foreground">
              {m['import.hand']()}
            </span>
            <ToggleGroup
              aria-labelledby={`${id}-hand`}
              value={[hand]}
              onValueChange={(value) => {
                const next = value[0] as Hand | undefined
                if (next) onHandChange(next)
              }}
            >
              <ToggleGroupItem value="right" className="px-3 text-sm">
                {m['import.hand_right']()}
              </ToggleGroupItem>
              <ToggleGroupItem value="left" className="px-3 text-sm">
                {m['import.hand_left']()}
              </ToggleGroupItem>
            </ToggleGroup>
          </span>
        )}
      </div>
      <ChipRadioGroup
        aria-labelledby={`${id}-part`}
        value={instrument}
        onValueChange={(value) => onInstrumentChange(value as InstrumentName)}
      >
        {INSTRUMENTS.map((value) => {
          const Icon = INSTRUMENT_ICON[value]
          return (
            <ChipRadio key={value} value={value}>
              <Icon aria-hidden className="size-4 shrink-0" strokeWidth={ICON_STROKE} />
              {instrumentLabel(value)}
            </ChipRadio>
          )
        })}
      </ChipRadioGroup>
    </div>
  )
}
