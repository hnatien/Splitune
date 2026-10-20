import { songs, uploads, withUser } from '@splitune/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Caller, caller, createTestApi, sha256Hex, signIn, userIdOf } from './helpers.ts'

// Defence in depth (17-security.md §2): even a query that skips the repository layer and its
// user_id filter cannot see another user's rows, because the API's transactions run as role `app`
// with RLS. Uses the API's own connection settings (the owner DATABASE_URL).
const api = createTestApi()
let alice: Caller
let aliceSongId: string
let bobId: string

beforeAll(async () => {
  const aliceCookie = await signIn(api)
  alice = caller(api, aliceCookie)
  const res = await alice.request('POST', '/v1/songs', {
    instrument: 'piano',
    source_kind: 'upload',
  })
  aliceSongId = ((await res.json()) as { song_id: string }).song_id
  await alice.request('POST', '/v1/uploads', {
    song_id: aliceSongId,
    filename: 'a.flac',
    bytes: 100,
    mime: 'audio/flac',
    file_sha256: sha256Hex('rls'),
  })
  bobId = await userIdOf(api, await signIn(api))
})
afterAll(() => api.close())

describe('RLS for role app', () => {
  it('hides another user’s rows from unfiltered queries', async () => {
    const seen = await withUser(api.db, bobId, async (tx) => ({
      songs: await tx.select({ id: songs.id, userId: songs.userId }).from(songs),
      uploads: await tx.select({ userId: uploads.userId }).from(uploads),
    }))
    expect(seen.songs.map((row) => row.id)).not.toContain(aliceSongId)
    expect(seen.songs.every((row) => row.userId === bobId)).toBe(true)
    expect(seen.uploads.every((row) => row.userId === bobId)).toBe(true)
    // The owner connection itself (no withUser) does see Alice's song: the filter is RLS.
    const ownerView = await api.db.select({ id: songs.id }).from(songs)
    expect(ownerView.map((row) => row.id)).toContain(aliceSongId)
  })

  it('cannot change another user’s rows, even with no WHERE clause', async () => {
    const changed = await withUser(api.db, bobId, (tx) =>
      tx.update(songs).set({ title: 'stolen' }).returning({ id: songs.id }),
    )
    expect(changed).toEqual([])
    const deleted = await withUser(api.db, bobId, (tx) =>
      tx.delete(songs).returning({ id: songs.id }),
    )
    expect(deleted).toEqual([])
    const song = await alice.request('GET', `/v1/songs/${aliceSongId}`)
    expect(((await song.json()) as { title: string }).title).toBe('Untitled')
  })
})
