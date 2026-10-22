import type { Instrument, Level } from '@splitune/contracts'
import { useEffect } from 'react'
import type { z } from 'zod'
import { analytics } from '@/lib/analytics'
import { formatDuration } from '@/lib/format'
import { m } from '@/lib/i18n'
import { StepDots } from '@/ui/step-dots'
import type { ExampleSong } from './examples'

// Pieces the onboarding steps share: the step count and dots, the onboarding answers, the
// example's summary card and the funnel event each step sends (16 §2).

export const STEP_COUNT = 5

export interface Answers {
  instrument: z.infer<typeof Instrument> | null
  level: z.infer<typeof Level> | null
}

const PART_LABEL = {
  riff: () => m['start.part_riff'](),
  rhythm: () => m['start.part_rhythm'](),
  bass_line: () => m['start.part_bass_line'](),
}

export function StepHeading({ step }: { step: number }) {
  return (
    <StepDots
      step={step}
      total={STEP_COUNT}
      text={m['start.step']({ step: String(step), total: String(STEP_COUNT) })}
      label={m['start.progress']()}
    />
  )
}

/** The example's card: title, then artist · part · length. */
export function SongSummary({ example }: { example: ExampleSong }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <span className="text-lg font-semibold">{example.title}</span>
      <span className="text-sm text-muted-foreground">
        {[example.artist, PART_LABEL[example.part](), formatDuration(example.duration_s)]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </div>
  )
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
