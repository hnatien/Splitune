import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Caller, caller, createTestApi, sha256Hex, signIn, userIdOf } from './helpers.ts'

// Step 12's practice data: corrections (idempotent replays), loop clips, practice sync with the
// best clean tempo, progress, and the song's own media URL.

const api = createTestApi()
let alice: Caller
let aliceId: string
let bob: Caller
let songId: string
let artefactId: string

const json = async <T>(res: Response) => (await res.json()) as T
const sql = (text: string, values: unknown[] = []) => api.db.$client.query(text, values)

beforeAll(async () => {
  const cookie = await signIn(api)
  alice = caller(api, cookie)
  aliceId = await userIdOf(api, cookie)
  bob = caller(api, await signIn(api))
  const song = await alice.request('POST', '/v1/songs', {
    title: 'Practice song',
    instrument: 'guitar',
    source_kind: 'upload',
  })
  songId = (await json<{ song_id: string }>(song)).song_id
  const { rows } = await sql(
    `insert into analyses (user_id, song_id, version, pipeline_version, config_profile,
                           requested_instrument, analysis_type, status, idempotency_key)
     values ($1, $2, 1, 'test', 'personal', 'guitar', 'full', 'done', $3) returning id`,
    [aliceId, songId, randomUUID()],
  )
  const analysisId = (rows[0] as { id: string }).id
  const artefact = await sql(
    `insert into artefacts (user_id, analysis_id, kind, version, object_key, bytes, sha256, model_refs)
     values ($1, $2, 'chords', 1, $3, 2, $4, '[]') returning id`,
    [aliceId, analysisId, `u/${aliceId}/a/${analysisId}/v1/chords.json`, sha256Hex('chords')],
  )
  artefactId = (artefact.rows[0] as { id: string }).id
})
afterAll(() => api.close())

describe('corrections', () => {
  const first = {
    client_op_id: randomUUID(),
    op: { op: 'set_chord', segment_id: 'c1', label: 'A:min' },
  }
  const second = { client_op_id: randomUUID(), op: { op: 'report_wrong', entity_id: 'n000003' } }

  it('appends ops with consecutive revs and replays them idempotently', async () => {
    const res = await alice.request('POST', `/v1/artefacts/${artefactId}/corrections`, {
      ops: [first, second],
    })
    expect(res.status).toBe(200)
    const body = await json<{ applied: { client_op_id: string; rev: number }[] }>(res)
    expect(body.applied).toEqual([
      { client_op_id: first.client_op_id, rev: 1 },
      { client_op_id: second.client_op_id, rev: 2 },
    ])
    // The offline queue resends the batch plus a new op: old revs come back, only the new op is
    // stored.
    const third = { client_op_id: randomUUID(), op: { op: 'delete_note', note_id: 'n000001' } }
    const replay = await alice.request('POST', `/v1/artefacts/${artefactId}/corrections`, {
      ops: [first, second, third],
    })
    expect((await json<{ applied: unknown[] }>(replay)).applied).toEqual([
      { client_op_id: first.client_op_id, rev: 1 },
      { client_op_id: second.client_op_id, rev: 2 },
      { client_op_id: third.client_op_id, rev: 3 },
    ])
  })

  it('lists ops after a rev', async () => {
    const res = await alice.request('GET', `/v1/artefacts/${artefactId}/corrections?after_rev=1`)
    const body = await json<{ ops: { rev: number; client_op_id: string; op: { op: string } }[] }>(
      res,
    )
    expect(body.ops.map((o) => [o.rev, o.op.op])).toEqual([
      [2, 'report_wrong'],
      [3, 'delete_note'],
    ])
  })

  it('rejects ops the contract does not know', async () => {
    const res = await alice.request('POST', `/v1/artefacts/${artefactId}/corrections`, {
      ops: [{ client_op_id: randomUUID(), op: { op: 'rewrite_song' } }],
    })
    expect(res.status).toBe(400)
    expect((await json<{ code: string }>(res)).code).toBe('invalid_input')
  })

  it('answers 404 for another user’s artefact', async () => {
    const res = await bob.request('GET', `/v1/artefacts/${artefactId}/corrections`)
    expect(res.status).toBe(404)
  })
})

const LOOP = {
  start_bar: 2,
  start_beat: 1,
  end_bar: 3,
  end_beat: 4,
  start_s: 5.3,
  end_s: 10.1,
}

describe('loop clips', () => {
  let loopId: string

  it('creates a clip with the defaults', async () => {
    const res = await alice.request('POST', `/v1/songs/${songId}/loops`, LOOP)
    expect(res.status).toBe(201)
    const clip = await json<Record<string, unknown>>(res)
    loopId = clip.id as string
    expect(clip).toMatchObject({
      ...LOOP,
      song_id: songId,
      name: null,
      rest_between: 'none',
      count_in_bars: 1,
      trainer: null,
      best_clean_tempo_pct: null,
    })
  })

  it('updates and lists it', async () => {
    const res = await alice.request('PATCH', `/v1/songs/${songId}/loops/${loopId}`, {
      name: 'Chorus riff',
      count_in_bars: 2,
    })
    expect(res.status).toBe(200)
    const list = await json<{ items: { id: string; name: string; count_in_bars: number }[] }>(
      await alice.request('GET', `/v1/songs/${songId}/loops`),
    )
    expect(list.items).toMatchObject([{ id: loopId, name: 'Chorus riff', count_in_bars: 2 }])
  })

  it('refuses an empty range', async () => {
    const created = await alice.request('POST', `/v1/songs/${songId}/loops`, {
      ...LOOP,
      end_s: LOOP.start_s,
    })
    expect(created.status).toBe(400)
    const patched = await alice.request('PATCH', `/v1/songs/${songId}/loops/${loopId}`, {
      start_s: 20,
    })
    expect(patched.status).toBe(400)
  })

  it('keeps clips of other songs and users out of reach', async () => {
    expect((await bob.request('GET', `/v1/songs/${songId}/loops`)).status).toBe(404)
    expect((await bob.request('POST', `/v1/songs/${songId}/loops`, LOOP)).status).toBe(404)
    const other = await alice.request('POST', '/v1/songs', {
      title: 'Other',
      instrument: 'bass',
      source_kind: 'upload',
    })
    const otherId = (await json<{ song_id: string }>(other)).song_id
    expect((await alice.request('DELETE', `/v1/songs/${otherId}/loops/${loopId}`)).status).toBe(404)
  })

  it('deletes it', async () => {
    const res = await alice.request('DELETE', `/v1/songs/${songId}/loops/${loopId}`)
    expect(res.status).toBe(204)
    const list = await json<{ items: unknown[] }>(
      await alice.request('GET', `/v1/songs/${songId}/loops`),
    )
    expect(list.items).toEqual([])
  })
})

describe('practice sync and progress', () => {
  it('stores sessions and attempts once and raises the best clean tempo', async () => {
    const clip = await json<{ id: string }>(
      await alice.request('POST', `/v1/songs/${songId}/loops`, LOOP),
    )
    const session = {
      client_session_id: randomUUID(),
      song_id: songId,
      started_at: '2026-10-22T10:00:00.000Z',
      input_mode: 'keyboard',
    }
    const attempt = (tempo: number, outcome: string, at: string) => ({
      client_attempt_id: randomUUID(),
      client_session_id: session.client_session_id,
      loop_clip_id: clip.id,
      tempo_pct: tempo,
      outcome,
      at,
    })
    const attempts = [
      attempt(70, 'not_yet', '2026-10-22T10:01:00.000Z'),
      attempt(70, 'clean', '2026-10-22T10:02:00.000Z'),
      attempt(85, 'not_yet', '2026-10-22T10:03:00.000Z'),
    ]
    const body = { sessions: [session], attempts }
    const res = await alice.request('POST', '/v1/practice/sync', body)
    expect(res.status).toBe(200)
    const accepted = await json<{ accepted_sessions: string[]; accepted_attempts: string[] }>(res)
    expect(accepted.accepted_sessions).toEqual([session.client_session_id])
    expect(accepted.accepted_attempts.sort()).toEqual(
      attempts.map((a) => a.client_attempt_id).sort(),
    )
    // A replay counts as accepted and stores nothing new.
    const replay = await json<{ accepted_attempts: string[] }>(
      await alice.request('POST', '/v1/practice/sync', body),
    )
    expect(replay.accepted_attempts).toHaveLength(3)

    const progress = await json<{
      clips: { loop_clip_id: string; best_clean_tempo_pct: number; attempts: unknown[] }[]
    }>(await alice.request('GET', `/v1/progress?song_id=${songId}`))
    expect(progress.clips).toEqual([
      {
        loop_clip_id: clip.id,
        song_id: songId,
        best_clean_tempo_pct: 70,
        attempts: [
          { at: '2026-10-22T10:01:00.000Z', tempo_pct: 70, outcome: 'not_yet' },
          { at: '2026-10-22T10:02:00.000Z', tempo_pct: 70, outcome: 'clean' },
          { at: '2026-10-22T10:03:00.000Z', tempo_pct: 85, outcome: 'not_yet' },
        ],
      },
    ])

    // A slower clean pass never lowers it; a faster one raises it.
    await alice.request('POST', '/v1/practice/sync', {
      sessions: [],
      attempts: [
        attempt(60, 'clean', '2026-10-22T10:04:00.000Z'),
        attempt(85, 'clean', '2026-10-22T10:05:00.000Z'),
      ],
    })
    const clips = await json<{ items: { best_clean_tempo_pct: number }[] }>(
      await alice.request('GET', `/v1/songs/${songId}/loops`),
    )
    expect(clips.items[0]?.best_clean_tempo_pct).toBe(85)
  })

  it('keeps an attempt whose clip is gone or not the user’s, without the clip', async () => {
    const session = {
      client_session_id: randomUUID(),
      song_id: songId,
      started_at: '2026-10-22T11:00:00.000Z',
      input_mode: 'touch',
    }
    const foreignClip = randomUUID()
    const attemptId = randomUUID()
    const res = await alice.request('POST', '/v1/practice/sync', {
      sessions: [session],
      attempts: [
        {
          client_attempt_id: attemptId,
          client_session_id: session.client_session_id,
          loop_clip_id: foreignClip,
          tempo_pct: 90,
          outcome: 'clean',
          at: '2026-10-22T11:01:00.000Z',
        },
      ],
    })
    expect((await json<{ accepted_attempts: string[] }>(res)).accepted_attempts).toEqual([
      attemptId,
    ])
    const { rows } = await sql(
      'select loop_clip_id from practice_attempts where client_attempt_id = $1',
      [attemptId],
    )
    expect(rows).toEqual([{ loop_clip_id: null }])
  })

  it('ignores another user’s song', async () => {
    const res = await bob.request('POST', '/v1/practice/sync', {
      sessions: [
        {
          client_session_id: randomUUID(),
          song_id: songId,
          started_at: '2026-10-22T12:00:00.000Z',
          input_mode: 'touch',
        },
      ],
      attempts: [],
    })
    expect((await json<{ accepted_sessions: string[] }>(res)).accepted_sessions).toEqual([])
    const progress = await json<{ clips: unknown[] }>(
      await bob.request('GET', `/v1/progress?song_id=${songId}`),
    )
    expect(progress.clips).toEqual([])
  })
})

describe('GET /v1/songs/{id}/media', () => {
  it('signs the uploaded source once the upload is in', async () => {
    const missing = await alice.request('GET', `/v1/songs/${songId}/media?kind=source`)
    expect(missing.status).toBe(404)
    const upload = await json<{ upload_id: string }>(
      await alice.request('POST', '/v1/uploads', {
        song_id: songId,
        filename: 'riff.wav',
        bytes: 4,
        mime: 'audio/wav',
        file_sha256: sha256Hex(randomUUID()),
      }),
    )
    const { rows } = await sql(
      `update uploads set status = 'uploaded' where id = $1 returning object_key`,
      [upload.upload_id],
    )
    const key = (rows[0] as { object_key: string }).object_key
    // Signed before the object exists would hand out a dead link.
    expect((await alice.request('GET', `/v1/songs/${songId}/media?kind=source`)).status).toBe(404)
    await api.storage.putBytes(key, new Uint8Array([1, 2, 3, 4]), 'audio/wav')
    const res = await alice.request('GET', `/v1/songs/${songId}/media?kind=source`)
    expect(res.status).toBe(200)
    const signed = await json<{ url: string }>(res)
    expect(new Uint8Array(await (await fetch(signed.url)).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    )
    // An upload has no video.
    expect((await alice.request('GET', `/v1/songs/${songId}/media?kind=video`)).status).toBe(404)
    expect((await bob.request('GET', `/v1/songs/${songId}/media?kind=source`)).status).toBe(404)
  })
})
