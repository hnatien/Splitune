import type { Instrument, Level } from '@splitune/contracts'
import { useEffect } from 'react'
import type { z } from 'zod'
import { analytics } from '@/lib/analytics'
import { formatDuration } from '@/lib/format'
import { m } from '@/lib/i18n'
import type { ExampleSong } from './examples'

// Pieces /start and the guide share: the onboarding answers, how an example song is named and
// the funnel event each step sends (16 §2).

export interface Answers {
  instrument: z.infer<typeof Instrument> | null
  level: z.infer<typeof Level> | null
}

const PART_LABEL = {
  riff: () => m['start.part_riff'](),
  rhythm: () => m['start.part_rhythm'](),
  bass_line: () => m['start.part_bass_line'](),
}

/** "guitar riff", "bass line". */
export function partOf(example: ExampleSong): string {
  return PART_LABEL[example.part]()
}

/** The example's meta line: artist · part · length. */
export function exampleMeta(example: ExampleSong): string {
  return [example.artist, partOf(example), formatDuration(example.duration_s)]
    .filter(Boolean)
    .join(' · ')
}

export function useStepViewed(
  step: 'instrument' | 'level' | 'screen' | 'song' | 'loop' | 'save',
  { instrument, level }: Answers,
  when = true,
) {
  useEffect(() => {
    if (when) analytics.track('onboarding_step_viewed', { step, instrument, level })
  }, [step, instrument, level, when])
}
