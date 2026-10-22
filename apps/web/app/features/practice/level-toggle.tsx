import { m } from '@/lib/i18n'
import { CapoIcon } from '@/ui/icons'
import { NumberField } from '@/ui/number-field'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { levelsFor } from './model/levels'
import { usePractice } from './practice-context'

// LevelToggle (12 §2, 07 §6): the M11 levels of the learner's instrument (guitar: chords only,
// simplified, as transcribed; bass: roots, full) and the capo. Either recomputes the tab in the
// Worker (≤ 300 ms with the render, 12 §10).

const LEVEL_LABEL: Record<string, () => string> = {
  chords_only: () => m['practice.level_chords'](),
  simplified: () => m['practice.level_simplified'](),
  as_transcribed: () => m['practice.level_full'](),
  roots: () => m['practice.level_roots'](),
  full: () => m['practice.level_full'](),
}

export function LevelToggle({ capo = true }: { capo?: boolean }) {
  const { options, setOptions, data, layers } = usePractice()
  if (!layers.tab) return null
  const instrument = data.instrument
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        aria-label={m['practice.level']()}
        size="practice-2"
        value={[options.level]}
        onValueChange={(next) => {
          const level = next[0]
          if (level) setOptions({ level: level as typeof options.level })
        }}
      >
        {levelsFor(instrument).map((level) => (
          <ToggleGroupItem key={level} value={level}>
            {LEVEL_LABEL[level]?.()}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {capo && instrument === 'guitar' && (
        <div className="flex items-center gap-2">
          <CapoIcon aria-hidden className="size-6" />
          <NumberField
            value={options.capo}
            min={0}
            max={12}
            step={1}
            inputLabel={m['practice.capo']()}
            decrementLabel={m['practice.capo_down']()}
            incrementLabel={m['practice.capo_up']()}
            onValueChange={(value) => value !== null && setOptions({ capo: value })}
          />
        </div>
      )}
    </div>
  )
}
