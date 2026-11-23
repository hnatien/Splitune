import { useId } from 'react'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { ChoiceRow, ChoiceRowGroup } from '@/ui/choice-row'
import { ICON_STROKE } from '@/ui/icons/create'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { INSTRUMENT_ICON } from '../library/instrument-icon'

export type Hand = 'right' | 'left'

/** Handedness mirrors fretboards and chord shapes, so it only applies to fretted parts. */
const FRETTED: ReadonlySet<InstrumentName> = new Set(['guitar', 'bass'])

// "Your part" (27 §3.6): the six parts as choice rows (26 §12.1 ChoiceRow, the list form), each
// with its instrument drawing, two or three to a line; the chosen one has the ink edge and a
// check. The default comes from the profile. Fretted parts add Hand on the label row (the
// profile's handedness; changing it here changes the profile).
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
      <div className="flex min-h-target flex-wrap items-center justify-between gap-x-3">
        <span id={`${id}-part`} className="text-label">
          {m['import.your_part']()}
        </span>
        {FRETTED.has(instrument) && (
          <span className="flex items-center gap-2">
            <span id={`${id}-hand`} className="text-body-sm text-muted-foreground">
              {m['import.hand']()}
            </span>
            <ToggleGroup
              aria-labelledby={`${id}-hand`}
              size="sm"
              value={[hand]}
              onValueChange={(value) => {
                const next = value[0] as Hand | undefined
                if (next) onHandChange(next)
              }}
            >
              <ToggleGroupItem value="right">{m['import.hand_right']()}</ToggleGroupItem>
              <ToggleGroupItem value="left">{m['import.hand_left']()}</ToggleGroupItem>
            </ToggleGroup>
          </span>
        )}
      </div>
      <ChoiceRowGroup
        aria-labelledby={`${id}-part`}
        value={instrument}
        onValueChange={(value) => onInstrumentChange(value as InstrumentName)}
        className="grid-cols-2 gap-1 sm:grid-cols-3"
      >
        {INSTRUMENTS.map((value) => {
          const Icon = INSTRUMENT_ICON[value]
          return (
            <ChoiceRow
              key={value}
              size="sm"
              value={value}
              icon={<Icon aria-hidden strokeWidth={ICON_STROKE} />}
              label={instrumentLabel(value)}
            />
          )
        })}
      </ChoiceRowGroup>
    </div>
  )
}
