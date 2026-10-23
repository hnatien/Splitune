import type { TabLevel } from '@splitune/music-core'

// The M11 levels per instrument (07 §6; piano's chord levels, V13), apart from the Worker's code so the page can offer them
// without loading music-core's tab builder.

export function defaultLevel(instrument: string): TabLevel {
  return instrument === 'bass' ? 'full' : 'as_transcribed'
}

export function levelsFor(instrument: string): TabLevel[] {
  if (instrument === 'bass') return ['roots', 'full']
  // Piano reads a chord chart: the chords as played, or simplified to triads (V13).
  if (instrument === 'piano') return ['simplified', 'as_transcribed']
  return ['chords_only', 'simplified', 'as_transcribed']
}
