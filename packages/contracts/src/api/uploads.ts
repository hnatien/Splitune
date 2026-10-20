import { z } from 'zod'
import { Sha256Hex } from '../analysis/common.ts'

const PartNumber = z.number().int().min(1).max(10000)

export const PartUrl = z.object({ n: PartNumber, url: z.url() })

// Size and duration limits are enforced by the API (413 file_too_large / too_long), not here.
// The rights warranty is dropped in personal mode and required again on the commercial path.
export const CreateUploadInput = z.object({
  song_id: z.uuid(),
  filename: z.string().min(1).max(255),
  bytes: z.number().int().positive(),
  mime: z.string().min(1).max(127),
  file_sha256: Sha256Hex,
  rights_warranty: z.literal(true).optional(),
  tos_version: z.string().min(1).optional(),
})

export const UploadTarget = z.object({
  upload_id: z.uuid(),
  part_size: z.number().int().positive(),
  parts: z.array(PartUrl).min(1),
  expires_at: z.iso.datetime(), // part URLs expire after 1 h; refresh with refreshParts
})

export const DuplicateUpload = z.object({ duplicate_of_song_id: z.uuid() })

export const CreateUploadOutput = z.union([UploadTarget, DuplicateUpload])

export const RefreshPartsInput = z.object({
  id: z.uuid(),
  part_numbers: z.array(PartNumber).min(1).max(10000).optional(),
})

export const RefreshPartsOutput = z.object({
  parts: z.array(PartUrl),
  expires_at: z.iso.datetime(),
})

export const CompleteUploadInput = z.object({
  id: z.uuid(),
  parts: z
    .array(z.object({ n: PartNumber, etag: z.string().min(1) }))
    .min(1)
    .max(10000),
})

export const UploadStatus = z.enum([
  'pending',
  'uploaded',
  'validated',
  'rejected',
  'expired',
  'deleted',
])

export const UploadState = z.object({ upload_id: z.uuid(), status: UploadStatus })
