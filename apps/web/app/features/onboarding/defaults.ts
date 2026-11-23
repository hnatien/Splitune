import type { Instrument, Level } from '@splitune/contracts'
import type { z } from 'zod'
import type { PracticeSearch } from '../practice/practice-context'
import type { ExampleSong } from './examples'

// What the onboarding answers set (13 §1 "Instrument + level set defaults"): the level toggle
// (simplified for beginners, chords for "Something else"), the mix ("Your part loud"), the
// starting speed (the example's: 70 % just started, 80 % a few songs) and the suggested loop.

type InstrumentName = z.infer<typeof Instrument>
type LevelName = z.infer<typeof Level>

/**
 * The answers /start begins with, so a visitor can go straight to a song: guitar (most learners,
 * and the examples' fallback) and "just started" (the slowest starting speed). Changed on the page
 * or later in Settings.
 */
export const DEFAULT_INSTRUMENT: InstrumentName = 'guitar'
export const DEFAULT_LEVEL: LevelName = 'just_started'

/** The answers in effect: what the visitor chose, else the defaults. */
export function answersOf(search: {
  instrument?: InstrumentName | undefined
  level?: LevelName | undefined
}): { instrument: InstrumentName; level: LevelName } {
  return {
    instrument: search.instrument ?? DEFAULT_INSTRUMENT,
    level: search.level ?? DEFAULT_LEVEL,
  }
}

export function tabLevelFor(
  instrument: InstrumentName | null,
  songInstrument: InstrumentName,
  level: LevelName | null,
): NonNullable<PracticeSearch['level']> {
  if (instrument !== null && instrument !== songInstrument)
    return songInstrument === 'bass' ? 'roots' : 'chords_only'
  if (songInstrument === 'bass') return level === 'just_started' ? 'roots' : 'full'
  return level === 'just_started' ? 'simplified' : 'as_transcribed'
}

export function startingSpeed(example: ExampleSong, level: LevelName | null): number {
  return example.speed_pct[level ?? 'just_started']
}

/** The example's practice setup as practice search params (bars 1-based, 27 §5.3). */
export function examplePractice(
  example: ExampleSong,
  instrument: InstrumentName | null,
  level: LevelName | null,
): Required<Pick<PracticeSearch, 'loop' | 'speed' | 'mix' | 'level'>> {
  return {
    loop: `${example.loop.start_bar + 1}-${example.loop.end_bar + 1}`,
    speed: startingSpeed(example, level),
    mix: 'your-part',
    level: tabLevelFor(instrument, example.instrument, level),
  }
}
