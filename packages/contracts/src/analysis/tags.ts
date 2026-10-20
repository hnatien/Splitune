import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader, Instrument, MachineCode } from './common.ts'
import { InstrumentSubtype } from './presence.ts'

export const InstrumentTag = z
  .object({
    instrument: Instrument,
    present_prob: z.number().min(0).max(1), // clip-level tagger probability on the mixture
    subtype: InstrumentSubtype.optional(),
  })
  .register(contracts, { id: 'InstrumentTag' })

// Written by the `tag` stage (06-ml-pipeline-service.md §2) and read by `separate` (which stems are
// worth keeping) and `stem_post` (presence gating). When the tagger could not run, `instruments` is
// empty and `fallback_reason` is set: readers then assume every instrument is present.
export const Tags = ArtefactHeader.extend({
  artefact: z.literal('tags'),
  window_s: z.number().positive(),
  windows: z.number().int().nonnegative(),
  instruments: z.array(InstrumentTag),
  fallback_reason: MachineCode.optional(),
}).register(contracts, { id: 'Tags' })
