import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader, Instrument } from './common.ts'

export const ActivitySpan = z
  .object({
    t0: z.number().nonnegative(),
    t1: z.number().nonnegative(),
    energy_ratio: z.number().nonnegative(),
  })
  .register(contracts, { id: 'ActivitySpan' })

export const InstrumentSubtype = z
  .enum(['acoustic_guitar', 'electric_guitar', 'piano', 'synth_keys', 'organ'])
  .register(contracts, { id: 'InstrumentSubtype' })

export const InstrumentPresence = z
  .object({
    instrument: Instrument,
    present_prob: z.number().min(0).max(1),
    activity: z.array(ActivitySpan),
    bleed_suspected: z.boolean(),
    subtype: InstrumentSubtype.optional(),
  })
  .register(contracts, { id: 'InstrumentPresence' })

export const Presence = ArtefactHeader.extend({
  artefact: z.literal('presence'),
  instruments: z.array(InstrumentPresence),
}).register(contracts, { id: 'Presence' })
