import { ChevronDownIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { CapoIcon } from '@/ui/icons'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { LevelToggle, levelLabel } from './level-toggle'
import { usePractice } from './practice-context'

// Level and capo at the chord strip's end (12 §2): one button names the level (and the capo when
// one is set); the level toggle and, for guitar, the capo field open in a popover. Bass and drums
// have levels but no capo. It sits on the paper, so it takes the score's ink and staff colours.
// Stage keeps the chrome out.
export function ScoreTools({ capo }: { capo: boolean }) {
  const { options } = usePractice()
  const title = capo ? m['practice.level_and_capo']() : m['practice.level']()
  const summary = [
    levelLabel(options.level),
    options.capo > 0 ? m['practice.capo_fret']({ fret: String(options.capo) }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="ml-auto shrink-0 border-staff bg-paper text-ink hover:bg-bar-current in-data-[appearance=stage]:hidden"
            aria-label={`${title}: ${summary}`}
          />
        }
      >
        {capo && <CapoIcon aria-hidden />}
        {summary}
        <ChevronDownIcon aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto gap-4">
        <PopoverTitle>{title}</PopoverTitle>
        <LevelToggle capo={capo} />
      </PopoverContent>
    </Popover>
  )
}
