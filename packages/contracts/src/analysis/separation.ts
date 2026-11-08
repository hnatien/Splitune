import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader, Instrument, MachineCode, Sha256Hex } from './common.ts'

export const SeparatedStem = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,63}$/), // model output, e.g. "guitar", "instrumental"
    instrument: Instrument.optional(), // absent for complements such as "instrumental"
    role: z.enum(['target', 'complement', 'extra']),
    // Worker-local intermediate (25-personal-mode.md §5: separated audio stays on the Mac's disk),
    // relative to the worker's separation cache directory. Never a bucket key. 24-bit FLAC, or
    // float32 WAV for a stem that peaks above full scale (a loud master's stems can; step 28).
    file: z.string().regex(/^[a-z0-9]{16,64}\/[a-z0-9][a-z0-9_.-]{0,63}\.(flac|wav)$/),
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
  // Solo-instrument check (step 24, piano): energy of a fast model's drums, bass and vocals outputs
  // relative to the mixture. `applied` = below the configured threshold: the song is the target
  // instrument alone, that model's run is this separation (the chain was skipped) and notes are
  // transcribed from the mixture.
  solo_bypass: z.object({ rhythm_db: z.number(), applied: z.boolean() }).optional(),
  // Fallback when silent (step 29, piano): the chain's target stem energy relative to the mixture
  // (dB) and the tagger's present_prob for the target (absent without usable tags). `applied` =
  // below the configured threshold while the tagger heard the target: the outputs `provider` maps
  // to the target (keys + synth) replaced the target stem, which stem_post marks rough.
  fallback_when_silent: z
    .object({
      target_db: z.number(),
      present_prob: z.number().min(0).max(1).optional(),
      applied: z.boolean(),
      provider: z.string().min(1).optional(),
    })
    .optional(),
}).register(contracts, { id: 'Separation' })
