import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  artefactKey,
  createStorage,
  rawUploadKey,
  StorageKeyError,
  stemKey,
  storageConfigFromEnv,
  userPrefix,
} from '../src/index.ts'

const storage = createStorage(storageConfigFromEnv())
// A fresh user per run keeps runs independent; afterAll removes everything under it.
const user = `test-${randomUUID().slice(0, 8)}`

afterAll(async () => {
  await storage.deletePrefix(userPrefix(user))
  storage.client.destroy()
})

const MiB = 1024 * 1024

describe('presigned PUT and GET', () => {
  it('round-trips an object', async () => {
    const key = artefactKey(user, randomUUID(), 1, 'beats.json')
    const body = JSON.stringify({ bpm: 100 })
    const put = await storage.presignPut(key, { contentType: 'application/json' })
    const upload = await fetch(put, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body,
    })
    expect(upload.status).toBe(200)

    const get = await fetch(await storage.presignGet(key))
    expect(get.status).toBe(200)
    expect(await get.text()).toBe(body)
  })

  it('rejects a PUT whose content type or length differs from the signed one', async () => {
    const key = rawUploadKey(user, randomUUID(), 'song.mp3')
    const typed = await storage.presignPut(key, { contentType: 'audio/mpeg' })
    const wrongType = await fetch(typed, {
      method: 'PUT',
      headers: { 'content-type': 'text/html' },
      body: 'x',
    })
    expect(wrongType.status).toBe(403)

    const sized = await storage.presignPut(key, { contentType: 'audio/mpeg', contentLength: 4 })
    const tooBig = await fetch(sized, {
      method: 'PUT',
      headers: { 'content-type': 'audio/mpeg' },
      body: 'too large',
    })
    expect(tooBig.status).toBe(403)
    expect(await storage.listKeys(key)).toEqual([])
  })

  it('denies a GET without a signature or after the URL expires', async () => {
    const key = artefactKey(user, randomUUID(), 1, 'chords.json')
    const put = await storage.presignPut(key, { contentType: 'application/json' })
    await fetch(put, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' })

    const signed = new URL(await storage.presignGet(key, { expiresIn: 1 }))
    expect((await fetch(`${signed.origin}${signed.pathname}`)).status).toBe(403)
    await new Promise((resolve) => setTimeout(resolve, 2100))
    expect((await fetch(signed)).status).toBe(403)
  })

  it('refuses unsafe keys and out-of-range TTLs', async () => {
    await expect(storage.presignGet('../etc/passwd')).rejects.toThrow(StorageKeyError)
    await expect(storage.presignGet(userPrefix(user), { expiresIn: 0 })).rejects.toThrow(RangeError)
  })
})

describe('multipart upload via presigned part URLs', () => {
  it('uploads a 12 MiB file in 3 parts', async () => {
    const key = rawUploadKey(user, randomUUID(), 'take.wav')
    const file = randomBytes(12 * MiB)
    // S3 needs every part but the last to be at least 5 MiB.
    const parts = [
      file.subarray(0, 5 * MiB),
      file.subarray(5 * MiB, 10 * MiB),
      file.subarray(10 * MiB),
    ]

    const uploadId = await storage.createMultipartUpload(key, { contentType: 'audio/wav' })
    const uploaded = await Promise.all(
      parts.map(async (part, i) => {
        const url = await storage.presignUploadPart(key, uploadId, i + 1, {
          contentLength: part.length,
        })
        const response = await fetch(url, { method: 'PUT', body: part })
        expect(response.status).toBe(200)
        const etag = response.headers.get('etag')
        if (!etag) throw new Error('no ETag on part upload')
        return { partNumber: i + 1, etag }
      }),
    )
    await storage.completeMultipartUpload(key, uploadId, uploaded.reverse())

    const get = await fetch(await storage.presignGet(key))
    expect(get.status).toBe(200)
    expect(get.headers.get('content-type')).toBe('audio/wav')
    const downloaded = Buffer.from(await get.arrayBuffer())
    expect(downloaded.length).toBe(file.length)
    expect(downloaded.equals(file)).toBe(true)
  })

  it('can abort an upload', async () => {
    const key = rawUploadKey(user, randomUUID(), 'abandoned.flac')
    const uploadId = await storage.createMultipartUpload(key, { contentType: 'audio/flac' })
    const url = await storage.presignUploadPart(key, uploadId, 1)
    expect((await fetch(url, { method: 'PUT', body: randomBytes(1024) })).status).toBe(200)
    await storage.abortMultipartUpload(key, uploadId)
    await expect(
      storage.completeMultipartUpload(key, uploadId, [{ partNumber: 1, etag: '"x"' }]),
    ).rejects.toThrow()
    expect(await storage.listKeys(key)).toEqual([])
  })

  it('validates part numbers', async () => {
    const key = rawUploadKey(user, randomUUID(), 'a.mp3')
    await expect(storage.presignUploadPart(key, 'id', 0)).rejects.toThrow(RangeError)
    await expect(storage.presignUploadPart(key, 'id', 10_001)).rejects.toThrow(RangeError)
  })
})

describe('getBytes and putBytes', () => {
  it('round-trips bytes and reports a missing object as undefined', async () => {
    const key = artefactKey(user, randomUUID(), 1, 'summary.json')
    await storage.putBytes(key, '{"ok":true}', 'application/json')
    const body = await storage.getBytes(key, { maxBytes: 1024 })
    expect(new TextDecoder().decode(body)).toBe('{"ok":true}')
    const missing = artefactKey(user, randomUUID(), 1, 'summary.json')
    expect(await storage.getBytes(missing, { maxBytes: 1024 })).toBeUndefined()
  })

  it('refuses objects larger than maxBytes and unsafe keys', async () => {
    const key = artefactKey(user, randomUUID(), 1, 'chords.json')
    await storage.putBytes(key, randomBytes(2048), 'application/octet-stream')
    await expect(storage.getBytes(key, { maxBytes: 1024 })).rejects.toThrow(RangeError)
    await expect(storage.getBytes('../x', { maxBytes: 1024 })).rejects.toThrow(StorageKeyError)
    await expect(storage.putBytes('/abs', 'x', 'text/plain')).rejects.toThrow(StorageKeyError)
  })
})

describe('deletePrefix', () => {
  const putObject = async (key: string) => {
    const url = await storage.presignPut(key, { contentType: 'application/octet-stream' })
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream' },
      body: key,
    })
    expect(response.status).toBe(200)
  }

  it('removes everything under the prefix and nothing else', async () => {
    const analysisId = randomUUID()
    const doomed = `${userPrefix(user)}a/${analysisId}/`
    const inside = [
      artefactKey(user, analysisId, 1, 'manifest.json'),
      artefactKey(user, analysisId, 1, 'beats.json'),
      artefactKey(user, analysisId, 2, 'beats.json'),
      stemKey(user, analysisId, 1, 'guitar', 'm4a'),
      stemKey(user, analysisId, 1, 'minus_guitar', 'm4a'),
    ]
    // Shares the string prefix but is a different analysis.
    const sibling = artefactKey(user, randomUUID(), 1, 'beats.json')
    for (const key of [...inside, sibling]) await putObject(key)

    expect((await storage.listKeys(doomed)).sort()).toEqual([...inside].sort())
    expect(await storage.deletePrefix(doomed)).toBe(inside.length)
    expect(await storage.listKeys(doomed)).toEqual([])
    expect(await storage.listKeys(sibling)).toEqual([sibling])
    expect(await storage.deletePrefix(doomed)).toBe(0)
  })

  it('refuses prefixes outside u/{user_id}/', async () => {
    for (const prefix of ['', 'u/', 'u', 'examples/', `u/${user}`, `u/${user}/a`, '../']) {
      await expect(storage.deletePrefix(prefix), prefix).rejects.toThrow(StorageKeyError)
    }
  })
})
