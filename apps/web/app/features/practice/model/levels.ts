import type { PracticeLevel as Level } from '@splitune/contracts'
import type { z } from 'zod'

// The M11 levels per instrument (07 §6; piano's chord levels, V13; drums' groove levels, step 25),
// apart from the Worker's code so the page can offer them without loading music-core's builders.

export type PracticeLevel = z.infer<typeof Level>

export function defaultLevel(instrument: string): PracticeLevel {
  return instrument === 'bass' ? 'full' : 'as_transcribed'
}

export function levelsFor(instrument: string): PracticeLevel[] {
  if (instrument === 'bass') return ['roots', 'full']
  // Piano reads a chord chart: the chords as played, or simplified to triads (V13).
  if (instrument === 'piano') return ['simplified', 'as_transcribed']
  // Drums: the main groove, the hi-hat in eighths, or every hit.
  if (instrument === 'drums') return ['core_groove', 'simplified', 'as_transcribed']
  return ['chords_only', 'simplified', 'as_transcribed']
}
