import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CSRF_HEADER } from '../src/app.ts'
import { type Caller, caller, createTestApi, signIn } from './helpers.ts'

const api = createTestApi()
let cookie: string
let alice: Caller

beforeAll(async () => {
  cookie = await signIn(api)
  alice = caller(api, cookie)
})
afterAll(() => api.close())

const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T

describe('GET/PATCH /v1/me', () => {
  it('updates the profile and returns the new state', async () => {
    const res = await alice.request('PATCH', '/v1/me', {
      display_name: 'Alice',
      primary_instrument: 'bass',
      level: 'few_songs',
      handedness: 'left',
      training_opt_in: true,
    })
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({
      display_name: 'Alice',
      primary_instrument: 'bass',
      level: 'few_songs',
      handedness: 'left',
      training_opt_in: true,
      marketing_opt_in: false,
    })
    const cleared = await alice.request('PATCH', '/v1/me', { display_name: null })
    expect((await json<{ display_name: string | null }>(cleared)).display_name).toBeNull()
  })

  it('validates input with the shared schemas', async () => {
    const res = await alice.request('PATCH', '/v1/me', { handedness: 'both', level: 7 })
    expect(res.status).toBe(400)
    const body = await json<{ code: string; details: { issues: { path: string }[] } }>(res)
    expect(body.code).toBe('invalid_input')
    expect(body.details.issues.map((i) => i.path).sort()).toEqual(['handedness', 'level'])
  })
})

describe('songs', () => {
  it('creates, reads, updates, lists and deletes', async () => {
    const created = await alice.request('POST', '/v1/songs', {
      title: 'Come Together',
      artist: 'The Beatles',
      instrument: 'bass',
      source_kind: 'upload',
    })
    expect(created.status).toBe(201)
    const { song_id } = await json<{ song_id: string }>(created)

    const detail = await alice.request('GET', `/v1/songs/${song_id}`)
    expect(detail.status).toBe(200)
    expect(await json(detail)).toMatchObject({
      id: song_id,
      title: 'Come Together',
      artist: 'The Beatles',
      instrument: 'bass',
      source_kind: 'upload',
      status: 'importing',
      player_state: {},
      last_opened_at: expect.any(String),
      latest_analysis: null,
      artefacts: [],
      youtube: null,
    })

    const patched = await alice.request('PATCH', `/v1/songs/${song_id}`, {
      artist: null,
      player_state: { speed_pct: 70, view: 'tab', position_s: 12.5 },
    })
    expect(patched.status).toBe(200)
    expect(await json(patched)).toMatchObject({
      artist: null,
      title: 'Come Together',
      player_state: { speed_pct: 70, view: 'tab', position_s: 12.5 },
    })
    expect((await alice.request('PATCH', `/v1/songs/${song_id}`, {})).status).toBe(200)

    const deleted = await alice.request('DELETE', `/v1/songs/${song_id}`)
    expect(deleted.status).toBe(204)
    expect((await alice.request('GET', `/v1/songs/${song_id}`)).status).toBe(404)
    expect((await alice.request('DELETE', `/v1/songs/${song_id}`)).status).toBe(404)
  })

  it('pages the library with cursors and coerces query parameters', async () => {
    const owner = caller(api, await signIn(api))
    const ids: string[] = []
    for (const title of ['one', 'two', 'three']) {
      const res = await owner.request('POST', '/v1/songs', {
        title,
        instrument: 'guitar',
        source_kind: 'recording',
      })
      ids.push((await json<{ song_id: string }>(res)).song_id)
    }
    await owner.request('GET', `/v1/songs/${ids[0]}`) // opening moves it to the front

    const first = await json<{ items: { title: string }[]; next_cursor: string }>(
      await owner.request('GET', '/v1/songs?limit=2'),
    )
    expect(first.items.map((s) => s.title)).toEqual(['one', 'three'])
    expect(first.next_cursor).toEqual(expect.any(String))
    const second = await json<{ items: { title: string }[]; next_cursor: string | null }>(
      await owner.request('GET', `/v1/songs?limit=2&cursor=${first.next_cursor}`),
    )
    expect(second).toMatchObject({ items: [{ title: 'two' }], next_cursor: null })

    const bad = await owner.request('GET', '/v1/songs?cursor=not-a-cursor')
    expect(bad.status).toBe(400)
    expect((await json<{ code: string }>(bad)).code).toBe('invalid_input')
    expect((await owner.request('GET', '/v1/songs?limit=101')).status).toBe(400)
  })

  it('rejects invalid ids and bodies with invalid_input', async () => {
    expect((await alice.request('GET', '/v1/songs/not-a-uuid')).status).toBe(400)
    const res = await alice.request('POST', '/v1/songs', {
      instrument: 'kazoo',
      source_kind: 'url',
    })
    expect(res.status).toBe(400)
    const malformed = await api.app.request('/v1/songs', {
      method: 'POST',
      headers: { cookie, [CSRF_HEADER]: '1', 'content-type': 'application/json' },
      body: '{"title":',
    })
    expect(malformed.status).toBe(400)
    expect((await json<{ code: string }>(malformed)).code).toBe('invalid_input')
  })
})

describe('cross-cutting', () => {
  it('requires the CSRF header on cookie-authenticated mutations', async () => {
    const res = await api.app.request('/v1/songs', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ instrument: 'bass', source_kind: 'upload' }),
    })
    expect(res.status).toBe(403)
    expect(await json(res)).toMatchObject({
      code: 'forbidden',
      details: { reason: 'csrf_header_required' },
    })
    // Reads need no header.
    expect((await api.app.request('/v1/me', { headers: { cookie } })).status).toBe(200)
  })

  it('allows CORS only for configured origins, with credentials', async () => {
    const preflight = (origin: string) =>
      api.app.request('/v1/songs', {
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': `content-type,${CSRF_HEADER}`,
        },
      })
    const allowed = await preflight(api.config.appUrl)
    expect(allowed.headers.get('access-control-allow-origin')).toBe(api.config.appUrl)
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true')
    expect(allowed.headers.get('access-control-allow-headers')).toContain(CSRF_HEADER)
    const denied = await preflight('https://evil.example')
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('answers unknown routes and methods with not_found', async () => {
    for (const [method, path] of [
      ['GET', '/v1/nope'],
      ['PUT', '/v1/me'],
      ['GET', '/elsewhere'],
    ] as const) {
      const res = await alice.request(method, path)
      expect(res.status, `${method} ${path}`).toBe(404)
      expect((await json<{ code: string }>(res)).code).toBe('not_found')
    }
  })

  it('refuses oversized request bodies', async () => {
    const res = await alice.request('PATCH', '/v1/me', {
      display_name: 'x'.repeat(2 * 1024 * 1024),
    })
    expect(res.status).toBe(413)
    expect((await json<{ code: string }>(res)).code).toBe('file_too_large')
  })

  it('sets request ids and security headers', async () => {
    const res = await alice.request('GET', '/v1/me', undefined, { 'x-request-id': 'req-123' })
    expect(res.headers.get('x-request-id')).toBe('req-123')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect((await alice.request('GET', '/v1/me')).headers.get('x-request-id')).toMatch(/\S+/)
  })

  it('serves health and readiness', async () => {
    expect(await json(await api.app.request('/internal/health'))).toEqual({ status: 'ok' })
    expect(await json(await api.app.request('/internal/ready'))).toEqual({ status: 'ok' })
  })
})
