import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader, Instrument, MachineCode, Sha256Hex } from './common.ts'

export const SeparatedStem = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,63}$/), // model output, e.g. "guitar", "instrumental"
    instrument: Instrument.optional(), // absent for complements such as "instrumental"
    role: z.enum(['target', 'complement', 'extra']),
    // Worker-local intermediate (25-personal-mode.md §5: separated audio stays on the Mac's disk),
    // relative to the worker's separation cache directory. Never a bucket key.
    file: z.string().regex(/^[a-z0-9]{16,64}\/[a-z0-9][a-z0-9_.-]{0,63}\.flac$/),
    sha256: Sha256Hex,
    frames: z.number().int().positive(), // 44.1 kHz stereo frames
  })
  .register(contracts, { id: 'SeparatedStem' })

export const SeparationAttempt = z
  .object({ model: z.string().min(1), error_code: MachineCode })
  .register(contracts, { id: 'SeparationAttempt' })

// Written by the `separate` stage: which model of the instrument's fallback chain produced the raw
// stems (config/separation.personal.yaml) and where they are. `stem_post` turns them into stems.json.
export const Separation = ArtefactHeader.extend({
  artefact: z.literal('separation'),
  target: Instrument,
  provider: z.string().min(1), // same naming as Stem.provider, e.g. "bs_roformer:BS-Roformer-SW"
  mix_minus: z.enum(['subtract', 'complement']),
  device: z.enum(['cuda', 'mps', 'cpu']),
  stems: z.array(SeparatedStem).min(1),
  failed_attempts: z.array(SeparationAttempt), // earlier models of the chain, in order
}).register(contracts, { id: 'Separation' })
