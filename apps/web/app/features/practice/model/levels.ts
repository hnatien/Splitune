import type { TabLevel } from '@splitune/music-core'

// The M11 levels per instrument (07 §6), apart from the Worker's code so the page can offer them
// without loading music-core's tab builder.

export function defaultLevel(instrument: string): TabLevel {
  return instrument === 'bass' ? 'full' : 'as_transcribed'
}

export function levelsFor(instrument: string): TabLevel[] {
  return instrument === 'bass' ? ['roots', 'full'] : ['chords_only', 'simplified', 'as_transcribed']
}
