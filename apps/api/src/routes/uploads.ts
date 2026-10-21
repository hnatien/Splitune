import { randomUUID } from 'node:crypto'
import type { Upload } from '@splitune/db'
import { PUT_TTL_S, rawUploadKey, type Storage } from '@splitune/storage'
import { apiError } from '../errors.ts'
import { type ApiDeps, authed, userRateLimit } from '../procedures.ts'

// Limits of 13-import-onboarding-and-youtube-embed.md (proposal): ≤ 500 MB per file. Duration
// (≤ 20 min, too_long) is only known after ffprobe in the decode stage.
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024
const MiB = 1024 * 1024
const MIN_PART_SIZE = 8 * MiB // S3 needs ≥ 5 MiB for every part but the last
const MAX_PARTS = 10_000
// Raw uploads are kept this long; the sweeper aborts or deletes them afterwards (03 "Retention").
const RAW_RETENTION_MS = 7 * 24 * 3600 * 1000
// Containers ffprobe may accept; everything else is refused before any bytes are sent.
const MEDIA_TYPE = /^(audio|video)\/[a-z0-9.+-]+$|^application\/(ogg|octet-stream)$/

export function partPlan(bytes: number): { partSize: number; partCount: number } {
  const partSize = Math.max(MIN_PART_SIZE, Math.ceil(bytes / MAX_PARTS / MiB) * MiB)
  return { partSize, partCount: Math.ceil(bytes / partSize) }
}

// Every part has a signed Content-Length, so the stored object is exactly `bytes` long.
async function presignParts(storage: Storage, upload: Upload, partNumbers: number[]) {
  const { partSize, partCount } = uploadParts(upload)
  const multipartId = upload.multipartUploadId as string
  const expiresAt = new Date(Date.now() + PUT_TTL_S * 1000).toISOString()
  const parts = await Promise.all(
    partNumbers.map(async (n) => ({
      n,
      url: await storage.presignUploadPart(upload.objectKey, multipartId, n, {
        contentLength: n < partCount ? partSize : upload.bytes - (partCount - 1) * partSize,
      }),
    })),
  )
  return { parts, expires_at: expiresAt }
}

function uploadParts(upload: Upload) {
  const partSize = upload.partSize as number
  return { partSize, partCount: Math.ceil(upload.bytes / partSize) }
}

const range = (count: number) => Array.from({ length: count }, (_, i) => i + 1)

// Errors S3 reports for a bad part list (wrong ETag, gaps, undersized parts).
const BAD_PARTS = new Set(['InvalidPart', 'InvalidPartOrder', 'EntityTooSmall'])
const s3ErrorName = (error: unknown) => (error instanceof Error ? error.name : '')

async function pendingUpload(deps: ApiDeps, userId: string, uploadId: string): Promise<Upload> {
  const upload = await deps.repos.uploads.get(userId, uploadId)
  if (!upload) throw apiError('not_found')
  if (upload.status !== 'pending' || !upload.multipartUploadId || !upload.partSize) {
    throw apiError('conflict', { message: 'This upload is no longer in progress.' })
  }
  return upload
}

export const uploads = {
  create: authed.uploads.create
    .use(userRateLimit('uploads'))
    .handler(async ({ context, input }) => {
      const { userId, deps } = context
      if (input.bytes > MAX_UPLOAD_BYTES) {
        throw apiError('file_too_large', {
          message: 'Files up to 500 MB are supported.',
          details: { max_bytes: MAX_UPLOAD_BYTES },
        })
      }
      if (!MEDIA_TYPE.test(input.mime)) throw apiError('unsupported_media')
      const song = await deps.repos.songs.get(userId, input.song_id)
      if (!song) throw apiError('not_found')

      // "Import anyway" after the duplicate notice skips the check.
      if (!input.allow_duplicate) {
        const duplicate = await deps.repos.uploads.findByFileSha256(userId, input.file_sha256)
        if (duplicate?.songId) return { duplicate_of_song_id: duplicate.songId }
      }

      const id = randomUUID()
      const objectKey = rawUploadKey(userId, id, input.filename)
      const { partSize, partCount } = partPlan(input.bytes)
      const multipartUploadId = await deps.storage.createMultipartUpload(objectKey, {
        contentType: input.mime,
      })
      let upload: Upload
      try {
        upload = await deps.repos.uploads.create(userId, {
          id,
          songId: song.id,
          objectKey,
          multipartUploadId,
          partSize,
          bytes: input.bytes,
          mime: input.mime,
          fileSha256: input.file_sha256,
          rightsWarrantyAt: input.rights_warranty ? new Date() : null,
          status: 'pending',
          expiresAt: new Date(Date.now() + RAW_RETENTION_MS),
        })
      } catch (error) {
        // Best effort; a failure leaves an incomplete multipart upload behind, so it is logged.
        await deps.storage.abortMultipartUpload(objectKey, multipartUploadId).catch((abort) => {
          context.log.warn({ err_name: s3ErrorName(abort) }, 'multipart abort after failed insert')
        })
        throw error
      }
      const { parts, expires_at } = await presignParts(deps.storage, upload, range(partCount))
      return { upload_id: upload.id, part_size: partSize, parts, expires_at }
    }),

  // Duplicate check right after the browser hashed a picked file (27 §5.6 import.duplicate):
  // the song of a completed upload with the same bytes, if the user has one.
  lookup: authed.uploads.lookup.handler(async ({ context, input }) => {
    const duplicate = await context.deps.repos.uploads.findByFileSha256(
      context.userId,
      input.file_sha256,
    )
    return { song_id: duplicate?.songId ?? null }
  }),

  refreshParts: authed.uploads.refreshParts.handler(async ({ context, input }) => {
    const upload = await pendingUpload(context.deps, context.userId, input.id)
    const { partCount } = uploadParts(upload)
    const wanted = input.part_numbers ?? range(partCount)
    const outOfRange = wanted.filter((n) => n > partCount)
    if (outOfRange.length > 0) {
      throw apiError('invalid_input', {
        details: {
          issues: [{ path: 'part_numbers', code: 'part_out_of_range', part_count: partCount }],
        },
      })
    }
    return presignParts(context.deps.storage, upload, [...new Set(wanted)])
  }),

  complete: authed.uploads.complete.handler(async ({ context, input }) => {
    const { userId, deps } = context
    const upload = await deps.repos.uploads.get(userId, input.id)
    if (!upload) throw apiError('not_found')
    if (upload.status !== 'pending' || !upload.multipartUploadId || !upload.partSize) {
      throw apiError('conflict', { message: 'This upload was already completed or cancelled.' })
    }
    const { partCount } = uploadParts(upload)
    const numbers = new Set(input.parts.map((p) => p.n))
    if (
      numbers.size !== input.parts.length ||
      numbers.size !== partCount ||
      !range(partCount).every((n) => numbers.has(n))
    ) {
      throw apiError('invalid_input', {
        details: {
          issues: [{ path: 'parts', code: 'parts_incomplete', part_count: partCount }],
        },
      })
    }
    try {
      await deps.storage.completeMultipartUpload(
        upload.objectKey,
        upload.multipartUploadId,
        input.parts.map((p) => ({ partNumber: p.n, etag: p.etag })),
      )
    } catch (error) {
      const name = s3ErrorName(error)
      if (BAD_PARTS.has(name)) {
        throw apiError('invalid_input', {
          details: { issues: [{ path: 'parts', code: 'parts_mismatch' }] },
        })
      }
      if (name === 'NoSuchUpload') throw apiError('conflict')
      throw error
    }
    // Server validation (ffprobe) runs in the decode stage once an analysis is requested
    // (POST /v1/analyses, step 09); completing never starts one.
    const done = await deps.repos.uploads.transition(userId, upload.id, 'pending', {
      status: 'uploaded',
      multipartUploadId: null,
    })
    if (!done) throw apiError('conflict', { message: 'This upload was cancelled.' })
    return { upload_id: done.id, status: done.status }
  }),

  abort: authed.uploads.abort.handler(async ({ context, input }) => {
    const { userId, deps } = context
    const upload = await deps.repos.uploads.get(userId, input.id)
    if (!upload) throw apiError('not_found')
    if (upload.status === 'deleted') return
    if (upload.status !== 'pending' || !upload.multipartUploadId) {
      throw apiError('conflict', { message: 'This upload was already completed.' })
    }
    // Claim the upload first so a racing complete cannot also succeed in the database.
    const claimed = await deps.repos.uploads.transition(userId, upload.id, 'pending', {
      status: 'deleted',
      multipartUploadId: null,
    })
    if (!claimed) throw apiError('conflict', { message: 'This upload was already completed.' })
    try {
      await deps.storage.abortMultipartUpload(upload.objectKey, upload.multipartUploadId)
    } catch (error) {
      if (s3ErrorName(error) !== 'NoSuchUpload') throw error
    }
  }),
}
