import { z } from 'zod'
import { contracts } from '../registry.ts'
import { SchemaVersion } from './common.ts'

export const AltFingering = z
  .object({
    string: z.number().int().min(1).max(7),
    fret: z.number().int().min(0).max(24),
    cost: z.number().nonnegative(),
  })
  .register(contracts, { id: 'AltFingering' })

// bar matches beats.bar_index (0-based); beat is 1-based within the bar; tick is 0..ppq-1.
export const TabEvent = z
  .object({
    note_id: z.string().min(1), // FK into notes.* of the referenced version
    bar: z.number().int().min(-1),
    beat: z.number().int().positive(),
    tick: z.number().int().min(0).max(959), // PPQ 960
    duration_ticks: z.number().int().positive(),
    quantize_residual_ms: z.number(),
    string: z.number().int().min(1).max(7).optional(), // 1 = highest-pitched string
    fret: z.number().int().min(0).max(24).optional(),
    alt_fingerings: z.array(AltFingering).max(3).optional(),
    hand: z.enum(['L', 'R']).optional(), // piano (v1)
  })
  .register(contracts, { id: 'TabEvent' })

export const NotesRef = z
  .object({
    artefact: z.string().regex(/^notes\.(guitar|bass|piano|vocals|other)$/),
    artefact_version: z.number().int().positive(),
  })
  .register(contracts, { id: 'NotesRef' })

export const BeatsRef = z
  .object({
    artefact_version: z.number().int().positive(),
    corrections_rev: z.number().int().nonnegative(),
  })
  .register(contracts, { id: 'BeatsRef' })

export const TabLevel = z
  .enum(['chords_only', 'simplified', 'as_transcribed', 'roots', 'full'])
  .register(contracts, { id: 'TabLevel' })

export const Tab = z
  .object({
    schema_version: SchemaVersion,
    artefact: z.string().regex(/^tab\.(guitar|bass|piano|vocals|other)$/),
    analysis_id: z.uuid(),
    notes_ref: NotesRef,
    beats_ref: BeatsRef,
    ppq: z.literal(960),
    tuning_midi: z.array(z.number().int().min(0).max(127)), // e.g. [64,59,55,50,45,40]
    capo: z.number().int().min(0).max(12),
    level: TabLevel,
    fingering_mode: z.enum(['easiest', 'as_played']),
    events: z.array(TabEvent),
    music_core_version: z.string().min(1),
  })
  .register(contracts, { id: 'Tab' })
