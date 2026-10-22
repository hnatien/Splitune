import type { Instrument, Level } from '@splitune/contracts'
import type { z } from 'zod'
import type { PracticeSearch } from '../practice/practice-context'
import type { ExampleSong } from './examples'

// What the onboarding answers set (13 §1 "Instrument + level set defaults"): the level toggle
// (simplified for beginners, chords for "Something else"), the mix ("Your part loud"), the
// starting speed (the example's: 70 % just started, 80 % a few songs) and the suggested loop.

type InstrumentName = z.infer<typeof Instrument>
type LevelName = z.infer<typeof Level>

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
