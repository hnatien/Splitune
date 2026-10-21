import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { JobEvent, StageRequest } from '@splitune/contracts'
import { artefactKey, rawUploadKey, stemKey } from '@splitune/storage'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type Caller,
  caller,
  createTestApi,
  type SseMessage,
  sha256Hex,
  signIn,
  sseMessages,
  userIdOf,
} from './helpers.ts'

// Orchestration without workers: the graphs POST /v1/analyses, rerun and import-url enqueue, the
// SSE stream over job_events, worker presence and artefact URLs. test/pipeline.test.ts runs the
// graphs through the real (mock-mode) workers.

const api = createTestApi()
const sql = (text: string, values: unknown[] = []) => api.db.$client.query(text, values)
let alice: Caller
let aliceCookie: string
let aliceId: string

beforeAll(async () => {
  aliceCookie = await signIn(api)
  alice = caller(api, aliceCookie)
  aliceId = await userIdOf(api, aliceCookie)
})
afterAll(() => api.close())

const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T

interface AnalysisBody {
  type: string
  version: number
  stages: Record<string, { status: string }>
  artefacts: { id: string }[]
}
interface ErrorBody {
  code: string
  message: string
}

interface JobRow {
  id: number
  kind: string
  runner: string
  status: string
  priority: number
  depends_on: number[]
  soft_depends_on: number[]
  payload: {
    inputs: { source?: string; probe?: string; beats?: string }
    outputs: { source?: string; video?: string }
    params: Record<string, unknown>
  }
}

async function jobsOf(analysisId: string) {
  const { rows } = await sql(
    `select id::int, kind, runner, status, priority, depends_on::int[], soft_depends_on::int[], payload
     from jobs where analysis_id = $1 order by id`,
    [analysisId],
  )
  return rows as JobRow[]
}

// Edges by kind instead of job ids.
function edges(rows: JobRow[]): Record<string, { hard: unknown[]; soft: unknown[] }> {
  const kind = new Map(rows.map((r) => [r.id, r.kind]))
  return Object.fromEntries(
    rows.map((r) => [
      r.kind,
      {
        hard: r.depends_on.map((id) => kind.get(id)),
        soft: r.soft_depends_on.map((id) => kind.get(id)),
      },
    ]),
  )
}

async function eventsOf(analysisId: string) {
  const { rows } = await sql('select event from job_events where analysis_id = $1 order by id', [
    analysisId,
  ])
  return rows.map((r) => r.event as Record<string, unknown>)
}

async function setPresence(state: 'offline' | 'online' | 'stale') {
  await sql('delete from worker_heartbeats')
  if (state === 'offline') return
  const at = state === 'online' ? 'now()' : "now() - interval '3 minutes'"
  await sql(
    `insert into worker_heartbeats (worker_id, runner, hostname, version, heartbeat_at)
     values ('ml-test', 'python', 'mac', 't', ${at}), ('node-test', 'node', 'mac', 't', ${at})`,
  )
}

// A song with a completed upload, as POST /v1/uploads/{id}/complete leaves it.
async function uploadedSong(instrument = 'guitar') {
  const res = await alice.request('POST', '/v1/songs', { instrument, source_kind: 'upload' })
  const { song_id: songId } = await json<{ song_id: string }>(res)
  const uploadId = randomUUID()
  const rawKey = rawUploadKey(aliceId, uploadId, 'song.mp3')
  await sql(
    `insert into uploads (id, user_id, song_id, object_key, bytes, mime, file_sha256, status, expires_at)
     values ($1, $2, $3, $4, 10, 'audio/mpeg', $5, 'uploaded', now() + interval '7 days')`,
    [uploadId, aliceId, songId, rawKey, sha256Hex(uploadId)],
  )
  return { songId, rawKey }
}

async function analyse(songId: string, type: 'full' | 'lite', instrument = 'guitar') {
  const res = await alice.request('POST', '/v1/analyses', { song_id: songId, instrument, type })
  expect(res.status).toBe(202)
  return json<{ analysis_id: string; status: string }>(res)
}

// What the workers leave behind for a finished stage: its run and artefact row.
async function finishStage(analysisId: string, stage: string, kind: string) {
  await sql(
    `insert into stage_runs (analysis_id, stage, status, model_refs, cache_key, started_at, finished_at)
     values ($1, $2, 'done', '[]', $3, now(), now())`,
    [analysisId, stage, sha256Hex(`${analysisId}${stage}`)],
  )
  const { rows } = await sql(
    `insert into artefacts (user_id, analysis_id, kind, version, object_key, bytes, sha256, model_refs)
     values ($1, $2, $3, 1, $4, 2, $5, '[]') returning id`,
    [
      aliceId,
      analysisId,
      kind,
      artefactKey(aliceId, analysisId, 1, `${kind}.json`),
      sha256Hex(kind),
    ],
  )
  return (rows[0] as { id: string }).id
}

beforeEach(() => setPresence('online'))

describe('POST /v1/analyses', () => {
  it('refuses a song without uploaded audio', async () => {
    const res = await alice.request('POST', '/v1/songs', {
      instrument: 'guitar',
      source_kind: 'upload',
    })
    const { song_id } = await json<{ song_id: string }>(res)
    const refused = await alice.request('POST', '/v1/analyses', {
      song_id,
      instrument: 'guitar',
      type: 'full',
    })
    expect(refused.status).toBe(409)
    expect(await json(refused)).toMatchObject({
      code: 'conflict',
      details: { reason: 'source_not_ready' },
    })
  })

  it('enqueues the full graph with hard and soft edges, once per request', async () => {
    await setPresence('offline')
    const { songId, rawKey } = await uploadedSong()
    const accepted = await analyse(songId, 'full')
    expect(accepted.status).toBe('queued')
    const id = accepted.analysis_id
    const rows = await jobsOf(id)
    expect(rows.map((r) => r.kind)).toEqual([
      'decode',
      'beats',
      'tag',
      'separate',
      'stem_post',
      'chords',
      'notes.guitar',
      'finalize',
    ])
    expect(edges(rows)).toEqual({
      decode: { hard: [], soft: [] },
      beats: { hard: ['decode'], soft: [] },
      tag: { hard: ['decode'], soft: [] },
      separate: { hard: ['decode'], soft: ['tag'] },
      stem_post: { hard: ['decode', 'separate'], soft: ['tag'] },
      chords: { hard: ['decode', 'beats'], soft: ['stem_post'] },
      'notes.guitar': { hard: ['decode'], soft: ['stem_post'] },
      finalize: {
        hard: [],
        soft: ['decode', 'beats', 'tag', 'separate', 'stem_post', 'chords', 'notes.guitar'],
      },
    })
    expect(new Set(rows.map((r) => `${r.runner}:${r.priority}`))).toEqual(
      new Set(['python:100', 'node:100']),
    )
    for (const row of rows) {
      expect(StageRequest.parse(row.payload)).toMatchObject({
        analysis_id: id,
        user_id: aliceId,
        stage: row.kind,
      })
    }
    const byKind = new Map(rows.map((r) => [r.kind, r.payload]))
    const key = (file: string) => artefactKey(aliceId, id, 1, file)
    expect(byKind.get('decode')).toMatchObject({
      inputs: { source: rawKey },
      outputs: { probe: key('probe.json') },
    })
    expect(byKind.get('separate')?.params).toEqual({ instrument: 'guitar' })
    expect(byKind.get('chords')?.inputs).toEqual({
      source: rawKey,
      probe: key('probe.json'),
      beats: key('beats.json'),
      separation: key('separation.json'),
      stems: key('stems.json'),
    })
    expect(byKind.get('finalize')).toMatchObject({
      inputs: {
        beats: key('beats.json'),
        chords: key('chords.json'),
        stems: key('stems.json'),
        'notes.guitar': key('notes.guitar.json'),
      },
      outputs: {
        summary: key('summary.json'),
        'tab.guitar': key('tab.guitar.json'),
        'render.guitar': `u/${aliceId}/a/${id}/v1/render/guitar.alphatex`,
      },
      params: { instruments: ['guitar'], profile: 'full' },
    })
    // The Mac is offline: the stream will say why nothing happens.
    expect(await eventsOf(id)).toEqual([
      {
        type: 'analysis.waiting',
        reason: 'queued_waiting_for_worker',
        runner: 'python',
        at: expect.any(String),
      },
    ])

    const again = await analyse(songId, 'full')
    expect(again.analysis_id).toBe(id)
    expect(await jobsOf(id)).toHaveLength(8)

    const detail = await json<AnalysisBody>(await alice.request('GET', `/v1/analyses/${id}`))
    expect(detail).toMatchObject({
      id,
      song_id: songId,
      version: 1,
      type: 'welcome', // a Free user's first full analysis
      requested_instrument: 'guitar',
      status: 'queued',
      progress: 0,
      artefacts: [],
      finished_at: null,
    })
    expect(Object.values(detail.stages)).toHaveLength(8)
    expect(new Set(Object.values(detail.stages).map((s) => s.status))).toEqual(new Set(['pending']))
    const song = await json(await alice.request('GET', `/v1/songs/${songId}`))
    expect(song).toMatchObject({ status: 'analysing', latest_analysis: { id } })
  })

  it('plans Lite as decode → beats → chords on the mixture → finalize', async () => {
    const { songId, rawKey } = await uploadedSong('bass')
    const { analysis_id: id } = await analyse(songId, 'lite', 'bass')
    const rows = await jobsOf(id)
    expect(edges(rows)).toEqual({
      decode: { hard: [], soft: [] },
      beats: { hard: ['decode'], soft: [] },
      chords: { hard: ['decode', 'beats'], soft: [] },
      finalize: { hard: [], soft: ['decode', 'beats', 'chords'] },
    })
    const byKind = new Map(rows.map((r) => [r.kind, r.payload]))
    expect(Object.keys(byKind.get('chords')?.inputs ?? {}).sort()).toEqual([
      'beats',
      'probe',
      'source',
    ])
    expect(byKind.get('chords')?.inputs.source).toBe(rawKey)
    expect(byKind.get('finalize')?.params).toEqual({ instruments: ['bass'], profile: 'lite' })
    expect((await json<AnalysisBody>(await alice.request('GET', `/v1/analyses/${id}`))).type).toBe(
      'lite',
    )
  })

  it('gives instruments without a notes stage a chords-only finalize', async () => {
    const { songId } = await uploadedSong('piano')
    const rows = await jobsOf((await analyse(songId, 'full', 'piano')).analysis_id)
    expect(rows.map((r) => r.kind)).not.toContain('notes.piano')
    expect(Object.keys(rows.at(-1)?.payload.outputs ?? {})).toEqual(['summary'])
  })

  it('upgrades Lite to Full by reusing its decode and beats', async () => {
    const { songId } = await uploadedSong()
    const { analysis_id: lite } = await analyse(songId, 'lite')
    const probeId = await finishStage(lite, 'decode', 'probe')
    const beatsId = await finishStage(lite, 'beats', 'beats')
    await sql("update analyses set status = 'done' where id = $1", [lite])

    const { analysis_id: full } = await analyse(songId, 'full')
    const rows = await jobsOf(full)
    expect(rows.map((r) => r.kind)).toEqual([
      'tag',
      'separate',
      'stem_post',
      'chords',
      'notes.guitar',
      'finalize',
    ])
    expect(edges(rows)).toMatchObject({ chords: { hard: [], soft: ['stem_post'] } })
    const liteKey = (file: string) => artefactKey(aliceId, lite, 1, file)
    const byKind = new Map(rows.map((r) => [r.kind, r.payload]))
    expect(byKind.get('tag')?.inputs.probe).toBe(liteKey('probe.json'))
    expect(byKind.get('finalize')?.inputs.beats).toBe(liteKey('beats.json'))
    const events = await eventsOf(full)
    expect(events.slice(0, 2)).toEqual([
      {
        type: 'stage.completed',
        stage: 'decode',
        artefact: { id: probeId, kind: 'probe', version: 1 },
        at: expect.any(String),
      },
      {
        type: 'stage.completed',
        stage: 'beats',
        artefact: { id: beatsId, kind: 'beats', version: 1 },
        at: expect.any(String),
      },
    ])
    const detail = await json<AnalysisBody>(await alice.request('GET', `/v1/analyses/${full}`))
    expect(detail.version).toBe(2)
    expect(detail.stages).toMatchObject({
      decode: { status: 'done' },
      beats: { status: 'done' },
      separate: { status: 'pending' },
    })
    expect(detail.artefacts.map((a) => a.id).sort()).toEqual([beatsId, probeId].sort())
  })

  it('reruns as the next version, once per Idempotency-Key, keeping the old artefacts', async () => {
    const { songId } = await uploadedSong()
    const { analysis_id: first } = await analyse(songId, 'lite')
    const beatsId = await finishStage(first, 'beats', 'beats')
    const rerun = (key: string) =>
      alice.request('POST', `/v1/analyses/${first}/rerun`, undefined, { 'idempotency-key': key })
    const a = await json<{ analysis_id: string }>(await rerun('k1'))
    const b = await json<{ analysis_id: string }>(await rerun('k1'))
    const c = await json<{ analysis_id: string }>(await rerun('k2'))
    expect(b.analysis_id).toBe(a.analysis_id)
    expect(c.analysis_id).not.toBe(a.analysis_id)
    const versions = await sql('select version from analyses where song_id = $1 order by version', [
      songId,
    ])
    expect(versions.rows.map((r) => r.version)).toEqual([1, 2, 3])
    // A rerun recomputes (no reuse) under its own prefix; the first run's artefacts stay.
    expect((await jobsOf(a.analysis_id)).map((r) => r.kind)).toEqual([
      'decode',
      'beats',
      'chords',
      'finalize',
    ])
    const kept = await sql('select id from artefacts where analysis_id = $1', [first])
    expect(kept.rows).toEqual([{ id: beatsId }])
    expect((await alice.request('POST', `/v1/analyses/${randomUUID()}/rerun`)).status).toBe(404)
  })
})

describe('POST /v1/songs/import-url', () => {
  const importUrl = (body: Record<string, unknown>) =>
    alice.request('POST', '/v1/songs/import-url', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      instrument: 'guitar',
      type: 'full',
      ...body,
    })

  it('creates the song and its analysis with url_import first', async () => {
    const res = await importUrl({})
    expect(res.status).toBe(202)
    const { song_id, analysis_id, status } = await json<{
      song_id: string
      analysis_id: string
      status: string
    }>(res)
    expect(status).toBe('queued')
    const song = await json(await alice.request('GET', `/v1/songs/${song_id}`))
    expect(song).toMatchObject({
      title: 'Untitled',
      source_kind: 'url',
      source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'importing',
    })
    const rows = await jobsOf(analysis_id)
    expect(rows[0]?.kind).toBe('url_import')
    const download = rows[0]?.payload
    expect(download?.inputs).toEqual({})
    expect(download?.params).toEqual({ download_video: true })
    const source = download?.outputs.source as string
    expect(source).toMatch(new RegExp(`^u/${aliceId}/raw/[0-9a-f-]{36}/source\\.bin$`))
    expect(download?.outputs.video).toBe(source.replace('source.bin', 'video.mp4'))
    expect(edges(rows)).toMatchObject({ decode: { hard: ['url_import'], soft: [] } })
    expect(rows.find((r) => r.kind === 'decode')?.payload.inputs.source).toBe(source)
    // The URL itself is read from the song by the worker, never copied into job payloads.
    expect(JSON.stringify(rows.map((r) => r.payload))).not.toContain('youtube')
  })

  it('skips the video when not asked for, and refuses local addresses', async () => {
    const res = await importUrl({ download_video: false, type: 'lite' })
    const rows = await jobsOf((await json<{ analysis_id: string }>(res)).analysis_id)
    expect(Object.keys(rows[0]?.payload.outputs ?? {})).toEqual(['source'])
    for (const url of [
      'http://localhost:8080/watch',
      'http://192.168.1.10/video',
      'http://[::1]/video',
      'https://nas.local/video',
      'https://intranet/video',
    ]) {
      const refused = await importUrl({ url })
      expect(refused.status, url).toBe(422)
      expect((await json<ErrorBody>(refused)).code).toBe('url_unsupported')
    }
  })

  it('downloads again for a new analysis only when no download succeeded', async () => {
    const { song_id, analysis_id } = await json<{ song_id: string; analysis_id: string }>(
      await importUrl({ type: 'lite' }),
    )
    const [download] = await jobsOf(analysis_id)
    await sql(
      "update jobs set status = 'failed', error_code = 'url_download_failed' where id = $1",
      [download?.id],
    )
    const retry = await analyse(song_id, 'full')
    expect((await jobsOf(retry.analysis_id))[0]?.kind).toBe('url_import')

    await sql("update jobs set status = 'done' where id = $1", [download?.id])
    const lite = await analyse(song_id, 'lite', 'bass')
    const rows = await jobsOf(lite.analysis_id)
    expect(rows[0]?.kind).toBe('decode')
    expect(rows[0]?.payload.inputs.source).toBe(download?.payload.outputs.source)
  })
})

describe('GET /v1/system/worker-status', () => {
  it('reports each runner online while its heartbeat is under 2 minutes old', async () => {
    const status = async () => json(await alice.request('GET', '/v1/system/worker-status'))
    expect(await status()).toEqual({
      online: true,
      runners: {
        python: { online: true, last_heartbeat_at: expect.any(String) },
        node: { online: true, last_heartbeat_at: expect.any(String) },
      },
    })
    await setPresence('stale')
    expect(await status()).toMatchObject({ online: false, runners: { python: { online: false } } })
    await setPresence('offline')
    expect(await status()).toEqual({
      online: false,
      runners: {
        python: { online: false, last_heartbeat_at: null },
        node: { online: false, last_heartbeat_at: null },
      },
    })
  })
})

describe('GET /v1/analyses/{id}/events', () => {
  const insertEvent = (analysisId: string, event: Record<string, unknown>) =>
    sql('insert into job_events (analysis_id, user_id, event) values ($1, $2, $3) returning id', [
      analysisId,
      aliceId,
      event,
    ])

  async function open(analysisId: string, lastEventId?: string) {
    const controller = new AbortController()
    const res = await api.app.request(`/v1/analyses/${analysisId}/events`, {
      headers: { cookie: aliceCookie, ...(lastEventId ? { 'last-event-id': lastEventId } : {}) },
      signal: controller.signal,
    })
    return { res, messages: sseMessages(res), close: () => controller.abort() }
  }

  async function take(messages: AsyncGenerator<SseMessage>, n: number) {
    const out: SseMessage[] = []
    while (out.length < n) {
      const { value, done } = await messages.next()
      if (done) break
      out.push(value)
    }
    return out
  }

  it('replays with ids, resumes after Last-Event-ID and ends on analysis.done', async () => {
    const { songId } = await uploadedSong()
    const { analysis_id: id } = await analyse(songId, 'lite')
    const at = '2026-10-21T10:00:00Z'
    await insertEvent(id, { type: 'stage.started', stage: 'decode', at })
    await insertEvent(id, { type: 'stage.completed', stage: 'decode', at })
    await insertEvent(id, { type: 'analysis.done', status: 'partial' })

    const first = await open(id)
    expect(first.res.status).toBe(200)
    expect(first.res.headers.get('content-type')).toContain('text/event-stream')
    const all: SseMessage[] = []
    for await (const message of first.messages) all.push(message)
    expect(all.map((m) => (m.data as { type: string }).type)).toEqual([
      'stage.started',
      'stage.completed',
      'analysis.done',
    ])
    expect(all.every((m) => m.event === 'message' && /^\d+$/.test(m.id ?? ''))).toBe(true)

    const resumed = await open(id, all[0]?.id)
    const rest: SseMessage[] = []
    for await (const message of resumed.messages) rest.push(message)
    expect(rest.map((m) => m.id)).toEqual([all[1]?.id, all[2]?.id])
  })

  it('pushes a new event on NOTIFY, well before the 5 s poll', async () => {
    const { songId } = await uploadedSong()
    const { analysis_id: id } = await analyse(songId, 'lite')
    const stream = await open(id)
    try {
      const pending = take(stream.messages, 1)
      // Give the stream time to subscribe and settle into its wait.
      await new Promise((resolve) => setTimeout(resolve, 300))
      const sent = Date.now()
      await insertEvent(id, { type: 'progress', value: 0.25 })
      const [message] = await pending
      expect(message?.data).toEqual({ type: 'progress', value: 0.25 })
      expect(Date.now() - sent).toBeLessThan(2_000)
    } finally {
      stream.close()
    }
  })

  it('tells a waiting client that the Mac went offline', async () => {
    const { songId } = await uploadedSong()
    const { analysis_id: id } = await analyse(songId, 'lite') // python online: no waiting event
    expect(await eventsOf(id)).toEqual([])
    await setPresence('stale')
    const stream = await open(id)
    try {
      const [message] = await take(stream.messages, 1)
      expect(message?.data).toMatchObject({
        type: 'analysis.waiting',
        reason: 'queued_waiting_for_worker',
        runner: 'python',
      })
    } finally {
      stream.close()
    }
  })

  it('ends when the analysis is deleted with its song', async () => {
    const { songId } = await uploadedSong()
    const { analysis_id: id } = await analyse(songId, 'lite')
    const stream = await open(id)
    const drained = (async () => {
      for await (const _ of stream.messages) {
        // drain
      }
    })()
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect((await alice.request('DELETE', `/v1/songs/${songId}`)).status).toBe(204)
    await drained // a poll later at the latest
  }, 15_000)
})

describe('GET /v1/artefacts/{id}/url', () => {
  it('signs documents and stem files for 15 minutes', async () => {
    const { songId } = await uploadedSong()
    const { analysis_id: id } = await analyse(songId, 'full')
    const stemsId = await finishStage(id, 'stem_post', 'stems')
    const stemsKey = artefactKey(aliceId, id, 1, 'stems.json')
    const fixture = readFileSync(
      new URL('../../../packages/contracts/fixtures/stems.json', import.meta.url),
      'utf8',
    )
    await api.storage.putBytes(
      stemsKey,
      JSON.stringify({ ...JSON.parse(fixture), analysis_id: id, user_id: aliceId }),
      'application/json',
    )
    const stemFile = stemKey(aliceId, id, 1, 'guitar', 'm4a')
    await api.storage.putBytes(stemFile, 'stem-audio', 'audio/mp4')

    const doc = await json<{ url: string; expires_at: string }>(
      await alice.request('GET', `/v1/artefacts/${stemsId}/url`),
    )
    const lifetime = new Date(doc.expires_at).getTime() - Date.now()
    expect(lifetime).toBeGreaterThan(14 * 60_000)
    expect(lifetime).toBeLessThanOrEqual(15 * 60_000)
    expect(((await (await fetch(doc.url)).json()) as { artefact: string }).artefact).toBe('stems')

    const stem = await json<{ url: string }>(
      await alice.request('GET', `/v1/artefacts/${stemsId}/url?stem_id=guitar&variant=aac_mp4`),
    )
    expect(await (await fetch(stem.url)).text()).toBe('stem-audio')
    const opus = await json<{ url: string }>(
      await alice.request('GET', `/v1/artefacts/${stemsId}/url?stem_id=guitar&variant=opus_webm`),
    )
    expect(new URL(opus.url).pathname).toMatch(/\/stems\/guitar\.webm$/)
    const unknown = await alice.request('GET', `/v1/artefacts/${stemsId}/url?stem_id=nope`)
    expect(unknown.status).toBe(404)
    const variantOnly = await alice.request('GET', `/v1/artefacts/${stemsId}/url?variant=aac_mp4`)
    expect(variantOnly.status).toBe(400)
    expect(await json(variantOnly)).toMatchObject({
      code: 'invalid_input',
      details: { issues: [{ path: 'variant', code: 'variant_needs_stem_id' }] },
    })
  })
})

describe('DELETE /v1/songs/{id}', () => {
  it('takes the queued jobs with it and cleans up now and again later', async () => {
    const { songId } = await uploadedSong()
    const { analysis_id: id } = await analyse(songId, 'full')
    expect(await jobsOf(id)).toHaveLength(8)
    expect((await alice.request('DELETE', `/v1/songs/${songId}`)).status).toBe(204)
    expect(await jobsOf(id)).toEqual([])
    const { rows } = await sql(
      `select run_after > now() + interval '20 minutes' as later, payload from jobs
       where kind = 'delete_prefix' and payload->'prefixes' ? $1 order by id`,
      [`u/${aliceId}/a/${id}/`],
    )
    expect(rows.map((r) => r.later)).toEqual([false, true])
  })
})

describe('machine-readable payloads', () => {
  const MACHINE = /^[a-z][a-z0-9_.]*$/
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/

  // Every string is a code, an id or a timestamp; everything else is a number or a boolean.
  function freeText(value: unknown, path = '$'): string[] {
    if (typeof value === 'string') {
      return MACHINE.test(value) || UUID.test(value) || TIME.test(value)
        ? []
        : [`${path}: ${value}`]
    }
    if (Array.isArray(value)) return value.flatMap((v, i) => freeText(v, `${path}[${i}]`))
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([k, v]) => freeText(v, `${path}.${k}`))
    }
    return []
  }

  it('job events carry codes and numbers only', async () => {
    const { rows } = await sql('select event from job_events')
    expect(rows.length).toBeGreaterThan(0)
    for (const { event } of rows) {
      JobEvent.parse(event)
      expect(freeText(event)).toEqual([])
    }
  })

  it('error envelopes carry codes in code and details (message is for logs only)', async () => {
    const bob = caller(api, await signIn(api))
    const { songId } = await uploadedSong()
    const responses = [
      await alice.request('POST', '/v1/analyses', { song_id: 'x', instrument: 'lute' }),
      await alice.request('GET', '/v1/songs?cursor=bm9wZQ'),
      await bob.request('GET', `/v1/analyses/${randomUUID()}`),
      await alice.request('POST', '/v1/songs/import-url', {
        url: 'http://localhost/x',
        instrument: 'guitar',
        type: 'lite',
      }),
      await caller(api).request('GET', `/v1/songs/${songId}`),
    ]
    expect(responses.map((r) => r.status)).toEqual([400, 400, 404, 422, 401])
    for (const res of responses) {
      const { message, ...rest } = await json<ErrorBody>(res)
      expect(typeof message).toBe('string')
      expect(freeText(rest)).toEqual([])
    }
  })
})
