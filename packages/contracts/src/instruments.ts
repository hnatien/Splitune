import type { z } from 'zod'
import type { Instrument } from './analysis/common.ts'
import type { PracticeLevel } from './api/analytics.ts'
import type { FlagKey } from './api/flags.ts'

// What each instrument gets, in one place: its notes stage (06 §2), what finalize writes, the
// score the practice screen builds and its M11 levels (07 §6; piano's chord levels, V13; drums'
// groove levels, step 25). The API plans from it, the node worker checks and finalizes by it, the
// web reads it, and services/ml loads its notes stages from schema/notes-stages.json, generated
// from it (scripts/build-schema.ts).

type InstrumentName = z.infer<typeof Instrument>
type Level = z.infer<typeof PracticeLevel>

export interface NotesStage {
  // Artefacts the notes.<instrument> stage reads besides the audio. Drums also read the downbeats
  // for the crash/ride default (stage_notes.drum_kit).
  reads: readonly ('separation' | 'stems' | 'beats')[]
  // What it writes: Notes, or DrumNotes for hits.
  schema: 'notes' | 'hits'
  // Planned only while this flag is on.
  flag?: FlagKey
}

export interface InstrumentProfile {
  // null: no notes stage; the instrument gets a chords-only summary.
  notes: NotesStage | null
  // finalize writes tab.<instrument> and render.<instrument> (music-core buildTab, fretted only).
  tab: boolean
  // The score the practice screen builds from the notes. Without a tab the web builds it after the
  // summary arrives.
  score: 'tab' | 'piano' | 'melody' | 'drums' | null
  // The screen holds the analysis status until the notes arrive rather than opening on the chords
  // alone: these instruments practise from their notes.
  holdsForNotes: boolean
  levels: readonly Level[]
  defaultLevel: Level
}

const PITCHED: NotesStage = { reads: ['separation', 'stems'], schema: 'notes' }
const CHORD_LEVELS: readonly Level[] = ['chords_only', 'simplified', 'as_transcribed']

export const INSTRUMENTS = {
  guitar: {
    notes: PITCHED,
    tab: true,
    score: 'tab',
    holdsForNotes: false,
    levels: CHORD_LEVELS,
    defaultLevel: 'as_transcribed',
  },
  bass: {
    notes: PITCHED,
    tab: true,
    score: 'tab',
    holdsForNotes: false,
    levels: ['roots', 'full'],
    defaultLevel: 'full',
  },
  // Piano reads a chord chart: the chords as played, or simplified to triads (V13).
  piano: {
    notes: PITCHED,
    tab: false,
    score: 'piano',
    holdsForNotes: true,
    levels: ['simplified', 'as_transcribed'],
    defaultLevel: 'as_transcribed',
  },
  // Drums: the main groove, the hi-hat in eighths, or every hit.
  drums: {
    notes: { reads: ['separation', 'stems', 'beats'], schema: 'hits', flag: 'v1.drums' },
    tab: false,
    score: 'drums',
    holdsForNotes: true,
    levels: ['core_groove', 'simplified', 'as_transcribed'],
    defaultLevel: 'as_transcribed',
  },
  vocals: {
    notes: PITCHED,
    tab: false,
    score: 'melody',
    holdsForNotes: false,
    levels: CHORD_LEVELS,
    defaultLevel: 'as_transcribed',
  },
  other: {
    notes: null,
    tab: false,
    score: null,
    holdsForNotes: false,
    levels: CHORD_LEVELS,
    defaultLevel: 'as_transcribed',
  },
} as const satisfies Record<InstrumentName, InstrumentProfile>

export function instrumentProfile(instrument: InstrumentName): InstrumentProfile {
  return INSTRUMENTS[instrument]
}

// The notes stages services/ml registers, keyed by instrument (schema/notes-stages.json).
export function notesStages(): Partial<Record<InstrumentName, NotesStage>> {
  return Object.fromEntries(
    Object.entries(INSTRUMENTS).flatMap(([instrument, { notes }]) =>
      notes === null ? [] : [[instrument, notes]],
    ),
  )
}
