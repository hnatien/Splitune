import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { assertSafeKey, StorageKeyError } from './keys.ts'

// S3 adapter for SeaweedFS (local) and Cloudflare R2 (production). Nothing here relies on bucket
// lifecycle rules, versioning or SSE (25-personal-mode.md §1): expiry of raw uploads and stems is
// done by the sweeper via deletePrefix.
//
// Presigned URLs are credentials: never log them.

export interface StorageConfig {
  // Omitted = AWS's regional endpoint.
  endpoint?: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  // SeaweedFS needs path-style URLs (http://host/bucket/key).
  forcePathStyle: boolean
}

// TTLs of 03 "Object storage layout": GET 15 min, PUT and multipart parts 1 h.
export const GET_TTL_S = 15 * 60
export const PUT_TTL_S = 60 * 60

export interface UploadedPart {
  partNumber: number
  etag: string
}

export function storageConfigFromEnv(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const {
    S3_ENDPOINT,
    S3_REGION,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_FORCE_PATH_STYLE,
  } = env
  const missing = Object.entries({ S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY })
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missing.length > 0) throw new Error(`missing storage config: ${missing.join(', ')}`)
  return {
    ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT } : {}),
    region: S3_REGION as string,
    bucket: S3_BUCKET as string,
    accessKeyId: S3_ACCESS_KEY_ID as string,
    secretAccessKey: S3_SECRET_ACCESS_KEY as string,
    forcePathStyle: S3_FORCE_PATH_STYLE === 'true',
  }
}

// Only user-scoped prefixes (u/{user_id}/…) may be bulk-deleted, so a bad argument can never
// empty the bucket.
const DELETABLE_PREFIX = /^u\/[A-Za-z0-9_-]+\/(.+\/)?$/

function ttl(seconds: number): number {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 7 * 24 * 3600) {
    throw new RangeError('presign ttl must be 1 s to 7 days')
  }
  return seconds
}

function partNumber(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 10_000)
    throw new RangeError('part number must be 1–10000')
  return n
}

// Headers the presigned request must reproduce exactly; a signed content-length caps the size.
function signed(headers: string[], contentLength: number | undefined): Set<string> {
  return new Set(contentLength === undefined ? headers : [...headers, 'content-length'])
}

export function createStorage(config: StorageConfig) {
  const { bucket } = config
  const client = new S3Client({
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Only send checksums when an operation requires them: presigned URLs then carry no checksum
    // parameters the browser would have to reproduce, and S3-compatible stores need not support
    // the SDK's newer default (CRC32) checksums.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  // Every object under `prefix` (the whole bucket when empty) with its size.
  async function listObjects(prefix: string): Promise<{ key: string; bytes: number }[]> {
    if (prefix !== '') assertSafeKey(prefix)
    const objects: { key: string; bytes: number }[] = []
    let token: string | undefined
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ...(prefix === '' ? {} : { Prefix: prefix }),
          ContinuationToken: token,
        }),
      )
      for (const object of page.Contents ?? []) {
        if (object.Key) objects.push({ key: object.Key, bytes: object.Size ?? 0 })
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (token)
    return objects
  }

  async function listKeys(prefix: string): Promise<string[]> {
    return (await listObjects(prefix)).map((object) => object.key)
  }

  return {
    client,
    bucket,

    presignGet: async (key: string, { expiresIn = GET_TTL_S }: { expiresIn?: number } = {}) =>
      getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: assertSafeKey(key) }), {
        expiresIn: ttl(expiresIn),
      }),

    // The client must send exactly the signed Content-Type (and Content-Length, if given).
    presignPut: async (
      key: string,
      {
        contentType,
        contentLength,
        expiresIn = PUT_TTL_S,
      }: { contentType: string; contentLength?: number; expiresIn?: number },
    ) =>
      getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: assertSafeKey(key),
          ContentType: contentType,
          ...(contentLength === undefined ? {} : { ContentLength: contentLength }),
        }),
        { expiresIn: ttl(expiresIn), signableHeaders: signed(['content-type'], contentLength) },
      ),

    async createMultipartUpload(
      key: string,
      { contentType }: { contentType: string },
    ): Promise<string> {
      const result = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: assertSafeKey(key),
          ContentType: contentType,
        }),
      )
      if (!result.UploadId) throw new Error('storage returned no multipart upload id')
      return result.UploadId
    },

    // A signed Content-Length caps the part size (17-security.md §3); the browser reads the part's
    // ETag response header, which the bucket's CORS rules must expose.
    presignUploadPart: async (
      key: string,
      uploadId: string,
      n: number,
      { contentLength, expiresIn = PUT_TTL_S }: { contentLength?: number; expiresIn?: number } = {},
    ) =>
      getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: bucket,
          Key: assertSafeKey(key),
          UploadId: uploadId,
          PartNumber: partNumber(n),
          ...(contentLength === undefined ? {} : { ContentLength: contentLength }),
        }),
        { expiresIn: ttl(expiresIn), signableHeaders: signed([], contentLength) },
      ),

    async completeMultipartUpload(
      key: string,
      uploadId: string,
      parts: UploadedPart[],
    ): Promise<void> {
      if (parts.length === 0) throw new RangeError('a multipart upload needs at least one part')
      const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber)
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: assertSafeKey(key),
          UploadId: uploadId,
          MultipartUpload: {
            Parts: sorted.map((p) => ({ PartNumber: partNumber(p.partNumber), ETag: p.etag })),
          },
        }),
      )
    },

    async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: assertSafeKey(key),
          UploadId: uploadId,
        }),
      )
    },

    listKeys,

    // Server-side reads and writes (Mac workers). undefined = no such object; objects larger than
    // maxBytes are refused.
    async getBytes(
      key: string,
      { maxBytes }: { maxBytes: number },
    ): Promise<Uint8Array | undefined> {
      let body: Uint8Array | undefined
      try {
        const object = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: assertSafeKey(key) }),
        )
        if (object.ContentLength !== undefined && object.ContentLength > maxBytes) {
          await object.Body?.transformToWebStream().cancel()
          throw new RangeError(`object larger than ${maxBytes} bytes`)
        }
        body = await object.Body?.transformToByteArray()
      } catch (error) {
        if ((error as { name?: string }).name === 'NoSuchKey') return undefined
        throw error
      }
      if (body === undefined || body.byteLength > maxBytes) {
        throw new RangeError(`object larger than ${maxBytes} bytes`)
      }
      return body
    },

    // Whether an object exists (HEAD), e.g. an optional download output before signing it.
    async exists(key: string): Promise<boolean> {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: assertSafeKey(key) }))
        return true
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        if ((error as { name?: string }).name === 'NotFound' || status?.httpStatusCode === 404) {
          return false
        }
        throw error
      }
    },

    async putBytes(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: assertSafeKey(key),
          Body: body,
          ContentType: contentType,
        }),
      )
    },

    // Object count and bytes under a prefix, or in the whole bucket (the daily digest compares it
    // with R2's 10 GB-month free tier; 25 §1).
    async usage(prefix = ''): Promise<{ objects: number; bytes: number }> {
      const objects = await listObjects(prefix)
      return { objects: objects.length, bytes: objects.reduce((sum, o) => sum + o.bytes, 0) }
    },

    // Deletes one object inside a user prefix; deleting a missing object succeeds (idempotent).
    async deleteKey(key: string): Promise<void> {
      assertSafeKey(key)
      if (!DELETABLE_PREFIX.test(key.slice(0, key.lastIndexOf('/') + 1))) {
        throw new StorageKeyError('deleteKey needs a key inside u/{user_id}/')
      }
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: [{ Key: key }], Quiet: true },
        }),
      )
    },

    // Deletes every object under a user-scoped prefix (song/account deletion, sweeper). Idempotent;
    // returns how many objects were deleted.
    async deletePrefix(prefix: string): Promise<number> {
      assertSafeKey(prefix)
      if (!DELETABLE_PREFIX.test(prefix)) {
        throw new StorageKeyError('deletePrefix needs a u/{user_id}/… prefix ending in /')
      }
      const keys = await listKeys(prefix)
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000)
        const result = await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }),
        )
        if (result.Errors && result.Errors.length > 0) {
          const first = result.Errors[0]
          throw new Error(
            `delete failed for ${result.Errors.length} object(s): ${first?.Code ?? 'unknown'}`,
          )
        }
      }
      return keys.length
    },
  }
}

export type Storage = ReturnType<typeof createStorage>
