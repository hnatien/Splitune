import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { v1Contract } from '../src/procedures.ts'
import { type Caller, caller, createTestApi, sha256Hex, signIn, userIdOf } from './helpers.ts'

// Authorization matrix (18-testing-strategy.md §4, 17-security.md §2), generated from the routed
// contract: every procedure must appear below, or this test fails. For each one, anonymous gets
// 401; for each procedure that addresses user A's resource (path id or body reference), user B
// gets 404 — the same answer as for an id that does not exist — and A's data is unchanged.
// Public procedures (example songs for visitors, product events) are listed as such and answer
// anonymous callers; their own tests cover what they expose.

interface Resources {
  songId: string
  uploadId: string
  analysisId: string
  artefactId: string
  loopId: string
}

interface Case {
  // Valid input apart from ownership, so only authorization can fail.
  body?: (r: Resources) => unknown
  // The resource of A the call addresses; undefined = the procedure has no resource id.
  target?: (r: Resources) => string
  // Query string of a GET with required parameters.
  query?: string
  // Answers without a session.
  public?: true
  // The path id when it names something that is not a user's resource (an example song).
  id?: string
}

const CASES: Record<string, Case> = {
  'me.get': {},
  'me.update': { body: () => ({ level: 'returning' }) },
  // The caller's own export request and account; nothing addresses another user.
  'me.export': {},
  'me.exportState': {},
  'me.delete': {},
  'songs.create': { body: () => ({ instrument: 'bass', source_kind: 'upload' }) },
  'songs.list': {},
  'songs.get': { target: (r) => r.songId },
  'songs.update': { target: (r) => r.songId, body: () => ({ title: 'stolen' }) },
  'songs.delete': { target: (r) => r.songId },
  'songs.mediaUrl': { target: (r) => r.songId, query: 'kind=source' },
  'uploads.create': {
    target: (r) => r.songId,
    body: (r) => ({
      song_id: r.songId,
      filename: 'x.mp3',
      bytes: 10,
      mime: 'audio/mpeg',
      file_sha256: sha256Hex('authz-create'),
    }),
  },
  'uploads.refreshParts': { target: (r) => r.uploadId, body: () => ({}) },
  'uploads.complete': {
    target: (r) => r.uploadId,
    body: () => ({ parts: [{ n: 1, etag: '"x"' }] }),
  },
  'uploads.abort': { target: (r) => r.uploadId },
  // Answers for the caller's own uploads only: tests/library.test.ts checks B sees null.
  'uploads.lookup': {},
  'songs.importUrl': {
    body: () => ({ url: 'https://www.youtube.com/watch?v=abc', instrument: 'bass', type: 'lite' }),
  },
  'analyses.create': {
    target: (r) => r.songId,
    body: (r) => ({ song_id: r.songId, instrument: 'guitar', type: 'lite' }),
  },
  'analyses.get': { target: (r) => r.analysisId },
  'analyses.events': { target: (r) => r.analysisId },
  'analyses.rerun': { target: (r) => r.analysisId },
  'artefacts.url': { target: (r) => r.artefactId },
  'artefacts.listCorrections': { target: (r) => r.artefactId },
  'artefacts.applyCorrections': {
    target: (r) => r.artefactId,
    body: () => ({
      ops: [{ client_op_id: randomUUID(), op: { op: 'report_wrong', entity_id: 'b0001' } }],
    }),
  },
  'loops.list': { target: (r) => r.songId },
  'loops.create': {
    target: (r) => r.songId,
    body: () => ({ start_bar: 0, start_beat: 1, end_bar: 1, end_beat: 4, start_s: 1, end_s: 3 }),
  },
  'loops.update': { target: (r) => r.songId, body: () => ({ name: 'stolen' }) },
  'loops.delete': { target: (r) => r.songId },
  // Writes only for the caller's own songs: tests/practice.test.ts checks B's sync stores nothing.
  'practice.sync': { body: () => ({ sessions: [], attempts: [] }) },
  'practice.progress': {},
  'system.workerStatus': {},
  'system.stats': {},
  'examples.list': { public: true },
  'examples.url': { public: true, id: 'no-such-example', query: `artefact_id=${randomUUID()}` },
  // Claims into the caller's own library: tests/examples.test.ts covers it.
  'examples.claim': {
    id: 'no-such-example',
    body: () => ({ loops: [], sessions: [], attempts: [], corrections: [] }),
  },
  'analytics.track': {
    public: true,
    body: () => ({ events: [{ name: 'example_song_opened', props: { example_id: 'a' } }] }),
  },
  // Prices for the pricing page, signed in or not.
  'billing.plans': { public: true },
  // The caller's own checkout and portal; mock sessions are bound to the user who opened them
  // (tests/billing.test.ts checks another user's session is a 404).
  'billing.checkout': { body: () => ({ plan: 'paid_monthly' }) },
  'billing.portal': {},
  'billing.mockSession': { query: 'session=x' },
  'billing.mockCheckout': { body: () => ({ session: 'x', outcome: 'cancel' }) },
  'billing.mockPortal': { body: () => ({ session: 'x', action: 'cancel' }) },
}

interface Route {
  key: string
  method: string
  path: string
}

function routes(node: object, prefix: string[] = []): Route[] {
  if ('~orpc' in node) {
    const { route } = (node as { '~orpc': { route: { method: string; path: string } } })['~orpc']
    return [{ key: prefix.join('.'), method: route.method, path: route.path }]
  }
  return Object.entries(node).flatMap(([name, child]) => routes(child as object, [...prefix, name]))
}

const ROUTES = routes(v1Contract)
const api = createTestApi()
let alice: Caller
let bob: Caller
const anonymous = caller(api)
let resources: Resources

const urlFor = (route: Route, id: string) => {
  const path = route.path
    .replace('{id}', CASES[route.key]?.id ?? id)
    .replace('{loop_id}', resources.loopId)
  const query = CASES[route.key]?.query
  return query ? `${path}?${query}` : path
}

async function call(who: Caller, route: Route, id: string) {
  const body = CASES[route.key]?.body?.(resources)
  return who.request(route.method, urlFor(route, id), body)
}

let aliceCookie: string

beforeAll(async () => {
  aliceCookie = await signIn(api)
  alice = caller(api, aliceCookie)
  bob = caller(api, await signIn(api))
  const song = await alice.request('POST', '/v1/songs', {
    title: 'Alice song',
    instrument: 'guitar',
    source_kind: 'upload',
  })
  const { song_id } = (await song.json()) as { song_id: string }
  const upload = await alice.request('POST', '/v1/uploads', {
    song_id,
    filename: 'a.mp3',
    bytes: 1024,
    mime: 'audio/mpeg',
    file_sha256: sha256Hex(randomBytes(8).toString('hex')),
  })
  const { upload_id } = (await upload.json()) as { upload_id: string }
  // An analysis with one artefact, as the workers would have left them.
  const aliceId = await userIdOf(api, aliceCookie)
  const { rows: analysisRows } = await api.db.$client.query(
    `insert into analyses (user_id, song_id, version, pipeline_version, config_profile,
                           requested_instrument, analysis_type, status, idempotency_key)
     values ($1, $2, 1, 'test', 'personal', 'guitar', 'lite', 'done', $3) returning id`,
    [aliceId, song_id, randomUUID()],
  )
  const analysisId = (analysisRows[0] as { id: string }).id
  const { rows: artefactRows } = await api.db.$client.query(
    `insert into artefacts (user_id, analysis_id, kind, version, object_key, bytes, sha256, model_refs)
     values ($1, $2, 'beats', 1, $3, 2, $4, '[]') returning id`,
    [aliceId, analysisId, `u/${aliceId}/a/${analysisId}/v1/beats.json`, sha256Hex('beats')],
  )
  const loop = await alice.request('POST', `/v1/songs/${song_id}/loops`, {
    start_bar: 0,
    start_beat: 1,
    end_bar: 1,
    end_beat: 4,
    start_s: 1,
    end_s: 3,
  })
  resources = {
    songId: song_id,
    uploadId: upload_id,
    analysisId,
    artefactId: (artefactRows[0] as { id: string }).id,
    loopId: ((await loop.json()) as { id: string }).id,
  }
})
afterAll(() => api.close())

describe('authorization matrix', () => {
  it('covers every routed procedure', () => {
    expect(ROUTES.map((r) => r.key).sort()).toEqual(Object.keys(CASES).sort())
    for (const route of ROUTES) {
      const c = CASES[route.key]
      if (route.path.includes('{id}')) expect(c?.target ?? c?.id, route.key).toBeDefined()
    }
  })

  it.each(ROUTES.filter((r) => !CASES[r.key]?.public))(
    'anonymous gets 401 on $method $path',
    async (route) => {
      const res = await call(anonymous, route, resources.songId)
      expect(res.status).toBe(401)
      expect(((await res.json()) as { code: string }).code).toBe('unauthenticated')
    },
  )

  it.each(ROUTES.filter((r) => CASES[r.key]?.public))(
    'anonymous is answered on public $method $path',
    async (route) => {
      const res = await call(anonymous, route, resources.songId)
      expect(res.status).not.toBe(401)
      expect(res.status).toBeLessThan(500)
    },
  )

  it.each(ROUTES.filter((r) => CASES[r.key]?.target))(
    'user B gets 404 for user A’s resource on $method $path',
    async (route) => {
      const target = CASES[route.key]?.target?.(resources) as string
      const res = await call(bob, route, target)
      expect(res.status).toBe(404)
      expect(((await res.json()) as { code: string }).code).toBe('not_found')
    },
  )

  it('leaves user A’s data untouched and invisible to B', async () => {
    const song = await alice.request('GET', `/v1/songs/${resources.songId}`)
    expect(song.status).toBe(200)
    expect(((await song.json()) as { title: string }).title).toBe('Alice song')
    const parts = await alice.request('POST', `/v1/uploads/${resources.uploadId}/parts`, {})
    expect(parts.status).toBe(200) // still pending: B's complete/abort did nothing
    const list = (await (await bob.request('GET', '/v1/songs')).json()) as {
      items: { id: string }[]
    }
    expect(list.items.map((s) => s.id)).not.toContain(resources.songId)
    // B's create/rerun on A's song and analysis started nothing.
    const runs = (await (await alice.request('GET', `/v1/songs/${resources.songId}`)).json()) as {
      latest_analysis: { id: string }
    }
    expect(runs.latest_analysis.id).toBe(resources.analysisId)
    // B's loop update and delete and correction append left A's clip and overlay alone.
    const loops = (await (
      await alice.request('GET', `/v1/songs/${resources.songId}/loops`)
    ).json()) as {
      items: { id: string; name: string | null }[]
    }
    expect(loops.items).toEqual([expect.objectContaining({ id: resources.loopId, name: null })])
    const ops = (await (
      await alice.request('GET', `/v1/artefacts/${resources.artefactId}/corrections`)
    ).json()) as { ops: unknown[] }
    expect(ops.ops).toEqual([])
  })
})
