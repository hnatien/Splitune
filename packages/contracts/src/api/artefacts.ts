import { z } from 'zod'
import { ArtefactKind, Sha256Hex } from '../analysis/common.ts'

export const ArtefactIndexEntry = z.object({
  id: z.uuid(),
  kind: ArtefactKind,
  version: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
  sha256: Sha256Hex,
  created_at: z.iso.datetime(),
  // Set when the sweeper deleted a stems artefact's audio after 180 days unused (15 §3); the JSON
  // stays, and re-running the analysis re-creates the stems.
  purged_at: z.iso.datetime().nullable(),
})

export const StemVariant = z.enum(['opus_webm', 'aac_mp4'])

// A stems artefact with `stem_id` signs that stem's audio file in `variant` (default aac_mp4);
// without `stem_id` every artefact signs its own document.
export const ArtefactUrlInput = z.object({
  id: z.uuid(),
  stem_id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_.-]{0,63}$/)
    .optional(),
  variant: StemVariant.optional(),
})

// Signed GET URL, valid for 15 minutes.
export const ArtefactUrlOutput = z.object({ url: z.url(), expires_at: z.iso.datetime() })
