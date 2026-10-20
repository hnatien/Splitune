import { z } from 'zod'
import { contracts } from '../registry.ts'
import { ArtefactHeader, Instrument } from './common.ts'

// AAC-LC in MP4 is the default every browser decodes; Opus in WebM is an optional smaller variant.
export const StemFile = z
  .object({
    codec: z.enum(['opus', 'aac']),
    container: z.enum(['webm', 'mp4']),
    path: z.string().min(1),
    bitrate_kbps: z.number().positive(),
  })
  .register(contracts, { id: 'StemFile' })

export const Stem = z
  .object({
    stem_id: z.string().min(1), // "guitar", "mix_minus_guitar", "drums", ...
    kind: z.enum(['isolated', 'mix_minus', 'residual']),
    instrument: Instrument.optional(),
    // personal: "htdemucs_6s" | "htdemucs_ft" | "bs_roformer:<ckpt>" | "mel_roformer:<ckpt>" | "scnet_xl"
    // commercial: "audioshake" | "musicai" | "lalal" | "spleeter"
    provider: z.string().min(1),
    files: z.array(StemFile).min(1),
    loudness_lufs: z.number(), // integrated, EBU R128
    gain_to_unity_db: z.number(), // applied only while soloing, so solo levels feel equal
    energy_ratio_to_mix: z.number().nonnegative(),
    quality_hint: z.enum(['good', 'rough']),
    empty: z.boolean(), // hidden in mixer (M4 "hide empty stems")
  })
  .register(contracts, { id: 'Stem' })

export const Stems = ArtefactHeader.extend({
  artefact: z.literal('stems'),
  stems: z.array(Stem),
  alignment_offset_samples: z.number().int(), // vendor stems re-aligned to the mixture timeline
  mix_gain_db: z.number(), // ONE gain for every stem (mixture measured to −14 LUFS) keeps the balance
}).register(contracts, { id: 'Stems' })
