import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader } from './common.ts'

// bar_index is 0-based from the first downbeat (pickup beats get -1); beat_in_bar is 1-based.
export const Beat = z
  .object({
    id: z.string().min(1),
    t: z.number().nonnegative(),
    activation: z.number().min(0).max(1),
    is_downbeat: z.boolean(),
    bar_index: z.number().int().min(-1),
    beat_in_bar: z.number().int().positive(),
  })
  .register(contracts, { id: 'Beat' })

export const Meter = z
  .object({
    numerator: z.number().int().positive(),
    denominator: z.number().int().positive(),
  })
  .register(contracts, { id: 'Meter' })

export const Beats = ArtefactHeader.extend({
  artefact: z.literal('beats'),
  beats: z.array(Beat),
  bpm: z.number().positive(), // median inter-beat interval
  bpm_curve: z.array(z.tuple([z.number(), z.number()])).optional(), // (t, bpm) for drifting live takes
  meter: Meter,
  tempo_octave_ambiguous: z.boolean(), // drives the half/double toggle (M7)
  first_downbeat_t: z.number().nonnegative(),
}).register(contracts, { id: 'Beats' })
