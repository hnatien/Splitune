import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Caller, caller, createTestApi, sha256Hex, signIn, userIdOf } from './helpers.ts'

// GET /v1/songs as the library (27 §3.5), the upload duplicate lookup and /v1/system/stats.

const api = createTestApi()
let alice: Caller
let aliceId: string
let bob: Caller

const json = async <T>(res: Response) => (await res.json()) as T
const sql = (text: string, values: unknown[] = []) => api.db.$client.query(text, values)

interface Page {
  items: {
    id: string
    title: string
    latest_analysis: unknown
    stems: string
    best_clean: unknown
  }[]
  next_cursor: string | null
}

async function createSong(who: Caller, title: string, instrument = 'guitar') {
  const res = await who.request('POST', '/v1/songs', {
    title,
    instrument,
    source_kind: 'upload',
  })
  return (await json<{ song_id: string }>(res)).song_id
}

beforeAll(async () => {
  const cookie = await signIn(api)
  alice = caller(api, cookie)
  aliceId = await userIdOf(api, cookie)
  bob = caller(api, await signIn(api))
})
afterAll(() => api.close())

describe('GET /v1/songs (library)', () => {
  let wonderwall: string

  beforeAll(async () => {
    wonderwall = await createSong(alice, 'Wonderwall')
    await createSong(alice, 'Another one', 'bass')
    await createSong(alice, 'wish you were here')
    await sql(`update songs set status = 'ready' where id = $1`, [wonderwall])
    const { rows } = await sql(
      `insert into analyses (user_id, song_id, version, pipeline_version, config_profile,
                             requested_instrument, analysis_type, status, idempotency_key,
                             recommended_view)
       values ($1, $2, 1, 'test', 'personal', 'guitar', 'full', 'done', $3, 'chords_only')
       returning id`,
      [aliceId, wonderwall, randomUUID()],
    )
    const analysisId = (rows[0] as { id: string }).id
    await sql(
      `insert into jobs (kind, runner, analysis_id, status)
       values ('decode', 'python', $1, 'done'), ('finalize', 'node', $1, 'done')`,
      [analysisId],
    )
    await sql(
      `insert into artefacts (user_id, analysis_id, kind, version, object_key, bytes, sha256,
                              model_refs)
       values ($1, $2, 'stems', 1, $3, 2, $4, '[]')`,
      [aliceId, analysisId, `u/${aliceId}/a/${analysisId}/v1/stems.json`, sha256Hex('stems')],
    )
    await sql(
      `insert into loop_clips (user_id, song_id, start_bar, end_bar, end_beat, start_s, end_s,
                               best_clean_tempo_pct)
       values ($1, $2, 16, 19, 4, 30, 38, 85)`,
      [aliceId, wonderwall],
    )
  })

  it('returns what each card shows', async () => {
    const page = await json<Page>(await alice.request('GET', '/v1/songs?q=wonder'))
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({
      title: 'Wonderwall',
      status: 'ready',
      latest_analysis: {
        type: 'full',
        status: 'done',
        stages_done: 2,
        stages_total: 2,
        recommended_view: 'chords_only',
      },
      stems: 'available',
      best_clean: { tempo_pct: 85, start_bar: 16, end_bar: 19 },
    })
    const fresh = await json<Page>(await alice.request('GET', '/v1/songs?q=another'))
    expect(fresh.items[0]).toMatchObject({ latest_analysis: null, stems: 'none', best_clean: null })
  })

  it('filters by instrument and status and sorts by title across pages', async () => {
    const titles = async (query: string) =>
      (await json<Page>(await alice.request('GET', `/v1/songs?${query}`))).items.map((s) => s.title)
    expect(await titles('instrument=bass')).toEqual(['Another one'])
    expect(await titles('status=ready')).toEqual(['Wonderwall'])
    // New songs are `importing`: the analysing chip covers them.
    expect(await titles('status=analysing&sort=title')).toEqual([
      'Another one',
      'wish you were here',
    ])

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const res = await alice.request(
        'GET',
        `/v1/songs?sort=title&limit=1${cursor ? `&cursor=${cursor}` : ''}`,
      )
      const page: Page = await json<Page>(res)
      seen.push(...page.items.map((s) => s.title))
      cursor = page.next_cursor
    } while (cursor)
    expect(seen).toEqual(['Another one', 'wish you were here', 'Wonderwall'])
  })

  it('refuses a cursor from another sort order and unknown sorts', async () => {
    const page = await json<Page>(await alice.request('GET', '/v1/songs?sort=title&limit=1'))
    const mixed = await alice.request('GET', `/v1/songs?sort=added&cursor=${page.next_cursor}`)
    expect(mixed.status).toBe(400)
    expect(await json<{ details: unknown }>(mixed)).toMatchObject({
      code: 'invalid_input',
      details: { issues: [{ path: 'cursor', code: 'invalid_cursor' }] },
    })
    expect((await alice.request('GET', '/v1/songs?sort=rating')).status).toBe(400)
    expect((await alice.request('GET', '/v1/songs?status=queued')).status).toBe(400)
  })

  it('shows nothing of another user’s library', async () => {
    const page = await json<Page>(await bob.request('GET', '/v1/songs?q=wonder'))
    expect(page.items).toEqual([])
  })
})

describe('upload duplicates', () => {
  const fileSha256 = sha256Hex(`dup-${randomUUID()}`)
  let songId: string

  beforeAll(async () => {
    songId = await createSong(alice, 'Uploaded')
    const res = await alice.request('POST', '/v1/uploads', {
      song_id: songId,
      filename: 'a.mp3',
      bytes: 1024,
      mime: 'audio/mpeg',
      file_sha256: fileSha256,
    })
    const { upload_id } = await json<{ upload_id: string }>(res)
    // Completed, as after uploads.complete.
    await sql(`update uploads set status = 'uploaded' where id = $1`, [upload_id])
  })

  it('looks up a completed upload by its hash, for its owner only', async () => {
    const lookup = (who: Caller, sha: string) =>
      who.request('GET', `/v1/uploads/lookup?file_sha256=${sha}`)
    expect(await json(await lookup(alice, fileSha256))).toEqual({ song_id: songId })
    expect(await json(await lookup(bob, fileSha256))).toEqual({ song_id: null })
    expect(await json(await lookup(alice, sha256Hex('never uploaded')))).toEqual({ song_id: null })
    expect((await lookup(alice, 'not-a-hash')).status).toBe(400)
  })

  it('creates a duplicate upload only when asked to', async () => {
    const other = await createSong(alice, 'Uploaded again')
    const body = {
      song_id: other,
      filename: 'a.mp3',
      bytes: 1024,
      mime: 'audio/mpeg',
      file_sha256: fileSha256,
    }
    const refused = await alice.request('POST', '/v1/uploads', body)
    expect(await json(refused)).toEqual({ duplicate_of_song_id: songId })
    const anyway = await alice.request('POST', '/v1/uploads', { ...body, allow_duplicate: true })
    expect(anyway.status).toBe(201)
    expect(await json(anyway)).toMatchObject({ upload_id: expect.any(String), parts: [{ n: 1 }] })
  })
})

describe('GET /v1/system/stats', () => {
  it('reports median stage times from recent runs', async () => {
    const song = await createSong(alice, 'Timed')
    for (const [i, seconds] of [4, 6, 30].entries()) {
      const { rows } = await sql(
        `insert into analyses (user_id, song_id, version, pipeline_version, config_profile,
                               requested_instrument, analysis_type, status, idempotency_key)
         values ($1, $2, $3, 'test', 'personal', 'guitar', 'lite', 'done', $4) returning id`,
        [aliceId, song, i + 1, randomUUID()],
      )
      await sql(
        `insert into stage_runs (analysis_id, stage, status, model_refs, cache_key, started_at,
                                 finished_at)
         values ($1, 'sections', 'done', '[]', 'k', now() - make_interval(secs => $2), now())`,
        [(rows[0] as { id: string }).id, seconds],
      )
    }
    const res = await bob.request('GET', '/v1/system/stats')
    expect(res.status).toBe(200)
    const { stages } = await json<{ stages: { stage: string }[] }>(res)
    expect(stages.find((s) => s.stage === 'sections')).toEqual({
      stage: 'sections',
      median_s: 6,
      runs: 3,
    })
  })
})
