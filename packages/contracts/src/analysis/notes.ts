import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader, Confidence, Instrument } from './common.ts'

export const Note = Confidence.extend({
  id: z.string().min(1),
  onset_s: z.number().nonnegative(),
  offset_s: z.number().nonnegative(),
  pitch_midi: z.number().int().min(21).max(108),
  velocity: z.number().int().min(1).max(127).optional(),
  bend_cents: z.array(z.tuple([z.number(), z.number()])).optional(), // (t offset s, cents)
  stem_id: z.string().min(1),
  // Bass: energy share of the stem at the f0 of pitch − 12 (octave correction, 07 §3).
  low_band_energy: z.number().min(0).max(1).optional(),
}).register(contracts, { id: 'Note' })

// Vocals only. Frame i is at i * hop_s on the decoded-PCM timeline.
export const F0Track = z
  .object({
    hop_s: z.number().positive(),
    hz: z.array(z.number().nonnegative()),
    voicing_prob: z.array(z.number().min(0).max(1)),
  })
  .register(contracts, { id: 'F0Track' })

export const Notes = ArtefactHeader.extend({
  artefact: z.string().regex(/^notes\.(guitar|bass|piano|vocals|other)$/),
  instrument: Instrument,
  notes: z.array(Note),
  f0: F0Track.optional(),
}).register(contracts, { id: 'Notes' })

export const DrumHit = Confidence.extend({
  id: z.string().min(1),
  onset_s: z.number().nonnegative(),
  class5: z.enum(['kick', 'snare', 'hihat', 'toms', 'cymbals']),
  gm_note: z.number().int().min(0).max(127), // General MIDI percussion number
  velocity: z.number().int().min(1).max(127).optional(),
  approximate: z.boolean(), // true for hi-hat open/closed, crash/ride, tom choice
}).register(contracts, { id: 'DrumHit' })

export const DrumNotes = ArtefactHeader.extend({
  artefact: z.literal('notes.drums'),
  instrument: z.literal('drums'),
  hits: z.array(DrumHit),
}).register(contracts, { id: 'DrumNotes' })
