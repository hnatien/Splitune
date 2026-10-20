import { randomBytes } from 'node:crypto'
import { queue } from '@splitune/db'
import { uploadPrefix } from '@splitune/storage'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, partPlan } from '../src/routes/uploads.ts'
import { type Caller, caller, createTestApi, sha256Hex, signIn, userIdOf } from './helpers.ts'

const api = createTestApi()
let alice: Caller
let aliceId: string

beforeAll(async () => {
  const cookie = await signIn(api)
  alice = caller(api, cookie)
  aliceId = await userIdOf(api, cookie)
})
afterAll(() => api.close())

const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T

interface Target {
  upload_id: string
  part_size: number
  parts: { n: number; url: string }[]
  expires_at: string
}

async function newSong(who = alice): Promise<string> {
  const res = await who.request('POST', '/v1/songs', {
    instrument: 'guitar',
    source_kind: 'upload',
  })
  return (await json<{ song_id: string }>(res)).song_id
}

async function startUpload(songId: string, file: Buffer, seed: string, who = alice) {
  return who.request('POST', '/v1/uploads', {
    song_id: songId,
    filename: 'My Song (live).mp3',
    bytes: file.length,
    mime: 'audio/mpeg',
    file_sha256: sha256Hex(seed),
  })
}

// What the browser does: PUT each part to its presigned URL, keep the ETags.
async function putParts(target: Target, file: Buffer) {
  return Promise.all(
    target.parts.map(async ({ n, url }) => {
      const body = file.subarray((n - 1) * target.part_size, n * target.part_size)
      const res = await fetch(url, { method: 'PUT', body })
      expect(res.status, `part ${n}`).toBe(200)
      return { n, etag: res.headers.get('etag') as string }
    }),
  )
}

describe('partPlan', () => {
  it('uses 8 MiB parts and stays within 10 000 parts', () => {
    expect(partPlan(1)).toEqual({ partSize: 8 * 1024 * 1024, partCount: 1 })
    expect(partPlan(20 * 1024 * 1024)).toEqual({ partSize: 8 * 1024 * 1024, partCount: 3 })
    expect(partPlan(MAX_UPLOAD_BYTES).partCount).toBe(63)
    expect(partPlan(200 * 1024 ** 3).partCount).toBeLessThanOrEqual(10_000)
  })
})

describe('multipart upload', () => {
  it('uploads through presigned parts, completes, and detects the duplicate', async () => {
    const songId = await newSong()
    const file = randomBytes(9 * 1024 * 1024) // two parts: 8 MiB + 1 MiB
    const created = await startUpload(songId, file, 'flow')
    expect(created.status).toBe(201)
    const target = await json<Target>(created)
    expect(target.parts.map((p) => p.n)).toEqual([1, 2])
    expect(Date.parse(target.expires_at)).toBeGreaterThan(Date.now() + 55 * 60_000)

    const refreshed = await alice.request('POST', `/v1/uploads/${target.upload_id}/parts`, {
      part_numbers: [2],
    })
    expect(refreshed.status).toBe(200)
    const [part2] = (await json<{ parts: { n: number; url: string }[] }>(refreshed)).parts
    expect(part2?.n).toBe(2)

    // A part longer than its signed Content-Length is refused by storage.
    const oversized = await fetch(part2?.url as string, {
      method: 'PUT',
      body: randomBytes(2 * 1024 * 1024),
    })
    expect(oversized.status).toBeGreaterThanOrEqual(400)

    const parts = await putParts(
      { ...target, parts: [target.parts[0] as Target['parts'][0], part2 as Target['parts'][0]] },
      file,
    )
    const wrongParts = await alice.request('POST', `/v1/uploads/${target.upload_id}/complete`, {
      parts: [parts[0]],
    })
    expect(wrongParts.status).toBe(400)

    const badEtag = await alice.request('POST', `/v1/uploads/${target.upload_id}/complete`, {
      parts: parts.map((p) => ({ ...p, etag: '"0000"' })),
    })
    expect(badEtag.status).toBe(400)
    expect((await json<{ code: string }>(badEtag)).code).toBe('invalid_input')

    const done = await alice.request('POST', `/v1/uploads/${target.upload_id}/complete`, { parts })
    expect(done.status).toBe(200)
    expect(await json(done)).toEqual({ upload_id: target.upload_id, status: 'uploaded' })

    const keys = await api.storage.listKeys(uploadPrefix(aliceId, target.upload_id))
    expect(keys).toEqual([`${uploadPrefix(aliceId, target.upload_id)}source.mp3`])

    const again = await alice.request('POST', `/v1/uploads/${target.upload_id}/complete`, { parts })
    expect(again.status).toBe(409)
    expect((await alice.request('DELETE', `/v1/uploads/${target.upload_id}`)).status).toBe(409)
    expect((await alice.request('POST', `/v1/uploads/${target.upload_id}/parts`, {})).status).toBe(
      409,
    )

    // Same bytes again, from any song: jump to the existing song instead of uploading.
    const duplicate = await startUpload(await newSong(), file, 'flow')
    expect(duplicate.status).toBe(201)
    expect(await json(duplicate)).toEqual({ duplicate_of_song_id: songId })
  })

  it('aborts a pending upload idempotently', async () => {
    const songId = await newSong()
    const target = await json<Target>(await startUpload(songId, randomBytes(1024), 'abort'))
    expect((await alice.request('DELETE', `/v1/uploads/${target.upload_id}`)).status).toBe(204)
    expect((await alice.request('DELETE', `/v1/uploads/${target.upload_id}`)).status).toBe(204)
    const complete = await alice.request('POST', `/v1/uploads/${target.upload_id}/complete`, {
      parts: [{ n: 1, etag: '"x"' }],
    })
    expect(complete.status).toBe(409)
  })

  it('refuses files over the size limit and non-media types', async () => {
    const songId = await newSong()
    const tooBig = await alice.request('POST', '/v1/uploads', {
      song_id: songId,
      filename: 'huge.wav',
      bytes: MAX_UPLOAD_BYTES + 1,
      mime: 'audio/wav',
      file_sha256: sha256Hex('big'),
    })
    expect(tooBig.status).toBe(413)
    expect(await json(tooBig)).toMatchObject({
      code: 'file_too_large',
      details: { max_bytes: MAX_UPLOAD_BYTES },
    })
    const notMedia = await alice.request('POST', '/v1/uploads', {
      song_id: songId,
      filename: 'evil.html',
      bytes: 10,
      mime: 'text/html',
      file_sha256: sha256Hex('html'),
    })
    expect(notMedia.status).toBe(415)
    expect((await json<{ code: string }>(notMedia)).code).toBe('unsupported_media')
  })

  it('limits upload sessions per user (20/h)', async () => {
    const bob = caller(api, await signIn(api))
    const songId = await newSong(bob)
    for (let i = 0; i < 20; i++) {
      const res = await startUpload(songId, randomBytes(16), `limit-${i}`, bob)
      expect(res.status).toBe(201)
      const { upload_id } = await json<{ upload_id: string }>(res)
      await bob.request('DELETE', `/v1/uploads/${upload_id}`)
    }
    const limited = await startUpload(songId, randomBytes(16), 'limit-20', bob)
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(await json(limited)).toMatchObject({
      code: 'rate_limited',
      retry_after_s: expect.any(Number),
    })
    // Other users keep their own allowance.
    expect((await startUpload(await newSong(), randomBytes(16), 'other')).status).toBe(201)
  })
})

describe('DELETE /v1/songs/{id}', () => {
  it('cascades rows and leaves a delete_prefix job that removes the objects', async () => {
    const songId = await newSong()
    const file = randomBytes(1024)
    const target = await json<Target>(await startUpload(songId, file, 'cascade'))
    const parts = await putParts(target, file)
    await alice.request('POST', `/v1/uploads/${target.upload_id}/complete`, { parts })
    const prefix = uploadPrefix(aliceId, target.upload_id)
    expect(await api.storage.listKeys(prefix)).toHaveLength(1)

    expect((await alice.request('DELETE', `/v1/songs/${songId}`)).status).toBe(204)
    expect(
      (await alice.request('POST', `/v1/uploads/${target.upload_id}/complete`, { parts })).status,
    ).toBe(404)

    // Act as the node worker: claim the job and delete each prefix.
    const job = await queue.claim(api.db, 'node', 'test-node-worker', { kinds: ['delete_prefix'] })
    expect(job?.payload).toEqual({ user_id: aliceId, prefixes: [prefix] })
    const { prefixes = [] } = (job?.payload ?? {}) as { prefixes?: string[] }
    for (const p of prefixes) await api.storage.deletePrefix(p)
    await queue.complete(api.db, job?.id as number, 'test-node-worker')
    expect(await api.storage.listKeys(prefix)).toEqual([])
  })
})
