import { z } from 'zod'
import { ArtefactKind, Sha256Hex } from '../analysis/common.ts'

export const ArtefactIndexEntry = z.object({
  id: z.uuid(),
  kind: ArtefactKind,
  version: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
  sha256: Sha256Hex,
  created_at: z.iso.datetime(),
})

export const StemVariant = z.enum(['opus_webm', 'aac_mp4'])

export const ArtefactUrlInput = z.object({ id: z.uuid(), variant: StemVariant.optional() })

// Signed GET URL, valid for 15 minutes.
export const ArtefactUrlOutput = z.object({ url: z.url(), expires_at: z.iso.datetime() })
