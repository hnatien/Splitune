import { instrumentProfile } from '@splitune/contracts'
import { ChevronDownIcon, PianoIcon } from 'lucide-react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { OptionSegments } from '../common/option-segments'
import { usePractice } from './practice-context'

// Piano options at the strip's end, in place of guitar's level and capo: the chords as triads or
// as played (piano's levels from its profile, recomputed in the Worker), the voicing and the
// hands the keyboard shows (practice defaults, this device). Without chords only the hands apply
// (to the falling notes). One button names the voicing and the level, or the hands (icon only in
// a narrow strip); it sits on the paper with the score's ink, and Stage keeps it out.

const PIANO = instrumentProfile('piano')
const LEVEL_LABEL: Partial<Record<(typeof PIANO.levels)[number], () => string>> = {
  simplified: () => m['practice.level_triads'](),
  as_transcribed: () => m['practice.level_full'](),
}

export function PianoOptions({
  handsOnly = false,
  className,
}: {
  handsOnly?: boolean
  className?: string
}) {
  const { options, setOptions } = usePractice()
  const voicing = usePracticeDefaults((s) => s.pianoVoicing)
  const hands = usePracticeDefaults((s) => s.pianoHands)
  const update = usePracticeDefaults((s) => s.update)
  const level = PIANO.levels.includes(options.level) ? options.level : PIANO.defaultLevel
  const handsLabel = hands === 'right' ? m['practice.hands_right']() : m['practice.hands_both']()
  const summary = handsOnly
    ? `${m['practice.hands']()}: ${handsLabel}`
    : [
        voicing === 'smooth' ? m['practice.voicing_smooth']() : m['practice.voicing_root'](),
        LEVEL_LABEL[level]?.() ?? '',
      ].join(' · ')
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              'shrink-0 border-staff bg-paper text-ink hover:bg-bar-current in-data-[appearance=stage]:hidden',
              className,
            )}
            aria-label={`${m['practice.piano_options']()}: ${summary}`}
          />
        }
      >
        <PianoIcon aria-hidden />
        {/* Narrow strips keep the icon; the name stays in the label. */}
        <span className="hidden @5xl:inline">{summary}</span>
        <ChevronDownIcon aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] gap-4">
        <PopoverTitle>{m['practice.piano_options']()}</PopoverTitle>
        {!handsOnly && (
          <>
            <OptionSegments
              label={m['practice.chords_level']()}
              value={level}
              options={PIANO.levels.map((value) => ({
                value,
                label: LEVEL_LABEL[value]?.() ?? '',
              }))}
              onChange={(next) => {
                setOptions({ level: next })
                track('level_changed', { level: next })
              }}
            />
            <OptionSegments
              label={m['practice.voicing']()}
              value={voicing}
              options={[
                { value: 'smooth', label: m['practice.voicing_smooth']() },
                { value: 'root', label: m['practice.voicing_root']() },
              ]}
              onChange={(pianoVoicing) => update({ pianoVoicing })}
            />
          </>
        )}
        <OptionSegments
          label={m['practice.hands']()}
          value={hands}
          options={[
            { value: 'both', label: m['practice.hands_both']() },
            { value: 'right', label: m['practice.hands_right']() },
          ]}
          onChange={(pianoHands) => update({ pianoHands })}
        />
      </PopoverContent>
    </Popover>
  )
}
