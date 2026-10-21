import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  Beats,
  Chords,
  JobEvent,
  Notes,
  Presence,
  Probe,
  Separation,
  Stems,
  Summary,
  Tab,
  Tags,
} from '@splitune/contracts'
import { analysisPrefix } from '@splitune/storage'
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest'
import type { z } from 'zod'
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

// Acceptance (step 09): upload → POST /v1/analyses → SSE in dependency order → analysis.done →
// artefact URLs that download valid JSON and audio, with the real Mac workers in ML_MODE=mock
// (services/ml worker via uv, apps/node-worker via node) against this test database.

const REPO = new URL('../../../', import.meta.url).pathname
const api = createTestApi()
let alice: Caller
let aliceCookie: string
let aliceId: string
const workers: ChildProcess[] = []
const cacheDir = mkdtempSync(join(tmpdir(), 'splitune-pipeline-'))

type Event = z.infer<typeof JobEvent>

const roleUrl = (role: 'ml_worker' | 'node_worker', password: string | undefined) => {
  const url = new URL(inject('databaseUrl'))
  url.username = role
  url.password = password ?? ''
  return url.toString()
}

// Output is kept for the failure message only (it carries no secrets: workers log codes).
function startWorkers(): void {
  const { DB_ML_WORKER_PASSWORD, DB_NODE_WORKER_PASSWORD } = process.env
  const ml = spawn('uv', ['run', '--frozen', 'splitune-ml-worker'], {
    cwd: join(REPO, 'services/ml'),
    env: {
      ...process.env,
      ML_MODE: 'mock',
      ML_DATABASE_URL: roleUrl('ml_worker', DB_ML_WORKER_PASSWORD),
      ML_WORKER_ID: 'ml-pipeline-test',
      ML_CACHE_DIR: cacheDir,
      ML_POLL_INTERVAL_S: '1',
      LOG_LEVEL: 'warning',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const node = spawn(process.execPath, ['src/main.ts'], {
    cwd: join(REPO, 'apps/node-worker'),
    env: {
      ...process.env,
      NODE_WORKER_DATABASE_URL: roleUrl('node_worker', DB_NODE_WORKER_PASSWORD),
      NODE_WORKER_ID: 'node-pipeline-test',
      NODE_WORKER_POLL_INTERVAL_S: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (const child of [ml, node]) {
    child.stdout?.resume()
    child.stderr?.resume()
    workers.push(child)
  }
}

async function stopWorkers(): Promise<void> {
  await Promise.all(
    workers.splice(0).map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) return resolve()
          child.once('exit', () => resolve())
          child.kill('SIGTERM')
        }),
    ),
  )
}

beforeAll(async () => {
  aliceCookie = await signIn(api)
  alice = caller(api, aliceCookie)
  aliceId = await userIdOf(api, aliceCookie)
  await api.db.$client.query('delete from worker_heartbeats')
})
afterEach(stopWorkers)
afterAll(async () => {
  await stopWorkers()
  rmSync(cacheDir, { recursive: true, force: true })
  await api.close()
})

const json = async <T>(res: Response) => (await res.json()) as T

// The browser's upload: create the song, PUT the parts to their presigned URLs, complete.
async function uploadSong(): Promise<string> {
  const { song_id } = await json<{ song_id: string }>(
    await alice.request('POST', '/v1/songs', { instrument: 'guitar', source_kind: 'upload' }),
  )
  const file = Buffer.from('RIFF....WAVE fake audio: the mock decode never reads it')
  const target = await json<{ upload_id: string; parts: { n: number; url: string }[] }>(
    await alice.request('POST', '/v1/uploads', {
      song_id,
      filename: 'song.wav',
      bytes: file.length,
      mime: 'audio/wav',
      file_sha256: sha256Hex(`${song_id}`),
    }),
  )
  const parts = await Promise.all(
    target.parts.map(async ({ n, url }) => {
      const res = await fetch(url, { method: 'PUT', body: file })
      return { n, etag: res.headers.get('etag') as string }
    }),
  )
  const done = await alice.request('POST', `/v1/uploads/${target.upload_id}/complete`, { parts })
  expect(done.status).toBe(200)
  return song_id
}

function stream(analysisId: string) {
  const controller = new AbortController()
  const response = api.app.request(`/v1/analyses/${analysisId}/events`, {
    headers: { cookie: aliceCookie },
    signal: controller.signal,
  })
  return { response, close: () => controller.abort() }
}

async function* events(res: Response): AsyncGenerator<Event> {
  for await (const message of sseMessages(res)) yield JobEvent.parse((message as SseMessage).data)
}

// Edges of the full graph (pipeline.ts), hard and soft: with every stage succeeding, a stage
// starts only after all of these completed.
const NEEDS: Record<string, string[]> = {
  beats: ['decode'],
  tag: ['decode'],
  separate: ['decode', 'tag'],
  stem_post: ['separate', 'tag'],
  chords: ['beats', 'stem_post'],
  'notes.guitar': ['decode', 'stem_post'],
  finalize: ['beats', 'tag', 'separate', 'stem_post', 'chords', 'notes.guitar'],
}

const SCHEMAS: Record<string, z.ZodType> = {
  probe: Probe,
  beats: Beats,
  tags: Tags,
  separation: Separation,
  stems: Stems,
  presence: Presence,
  chords: Chords,
  'notes.guitar': Notes,
  summary: Summary,
  'tab.guitar': Tab,
}

const MACHINE = /^[a-z][a-z0-9_.]*$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/
function freeText(value: unknown): string[] {
  if (typeof value === 'string') {
    return MACHINE.test(value) || UUID.test(value) || TIME.test(value) ? [] : [value]
  }
  if (Array.isArray(value)) return value.flatMap(freeText)
  if (value && typeof value === 'object') return Object.values(value).flatMap(freeText)
  return []
}

describe('analysis pipeline with mock-mode workers', () => {
  it('queues while the Mac is offline, then streams every stage to analysis.done', async () => {
    const songId = await uploadSong()
    const { analysis_id: id } = await json<{ analysis_id: string }>(
      await alice.request('POST', '/v1/analyses', {
        song_id: songId,
        instrument: 'guitar',
        type: 'full',
      }),
    )
    const sse = stream(id)
    const seen: Event[] = []
    try {
      const res = await sse.response
      expect(res.status).toBe(200)
      for await (const event of events(res)) {
        seen.push(event)
        // The workers start only after the client was told it is waiting for them.
        if (event.type === 'analysis.waiting') startWorkers()
      }
    } finally {
      sse.close()
    }
    expect(seen[0]).toMatchObject({ type: 'analysis.waiting', runner: 'python' })
    expect(seen.at(-1)).toMatchObject({ type: 'analysis.done', status: 'done' })

    const completedAt = new Map<string, number>()
    seen.forEach((event, i) => {
      if (event.type === 'stage.completed') completedAt.set(event.stage, i)
      if (event.type === 'stage.started') {
        for (const dep of NEEDS[event.stage] ?? []) {
          expect(completedAt.get(dep), `${event.stage} after ${dep}`).toBeLessThan(i)
        }
      }
    })
    expect([...completedAt.keys()].sort()).toEqual(
      [
        'decode',
        'beats',
        'tag',
        'separate',
        'stem_post',
        'chords',
        'notes.guitar',
        'finalize',
      ].sort(),
    )
    const progress = seen.flatMap((e) => (e.type === 'progress' ? [e.value] : []))
    expect(progress.length).toBeGreaterThan(0)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
    for (const event of seen) expect(freeText(event)).toEqual([])

    // Every artefact downloads through its signed URL and matches its contract.
    const detail = await json<{
      status: string
      progress: number
      artefacts: { id: string; kind: string }[]
    }>(await alice.request('GET', `/v1/analyses/${id}`))
    expect(detail).toMatchObject({ status: 'done', progress: 1 })
    for (const artefact of detail.artefacts) {
      const { url } = await json<{ url: string }>(
        await alice.request('GET', `/v1/artefacts/${artefact.id}/url`),
      )
      const res = await fetch(url)
      expect(res.status, artefact.kind).toBe(200)
      if (artefact.kind.startsWith('render.')) {
        expect((await res.text()).length).toBeGreaterThan(0)
        continue
      }
      const schema = SCHEMAS[artefact.kind]
      expect(schema, artefact.kind).toBeDefined()
      schema?.parse(await res.json())
    }
    const stemsArtefact = detail.artefacts.find((a) => a.kind === 'stems')
    const stems = Stems.parse(
      await (
        await fetch(
          (
            await json<{ url: string }>(
              await alice.request('GET', `/v1/artefacts/${stemsArtefact?.id}/url`),
            )
          ).url,
        )
      ).json(),
    )
    for (const stem of stems.stems) {
      const { url } = await json<{ url: string }>(
        await alice.request(
          'GET',
          `/v1/artefacts/${stemsArtefact?.id}/url?stem_id=${stem.stem_id}&variant=aac_mp4`,
        ),
      )
      const audio = Buffer.from(await (await fetch(url)).arrayBuffer())
      expect(audio.subarray(4, 8).toString('latin1'), stem.stem_id).toBe('ftyp') // MP4
    }
    const song = await json<{ status: string }>(await alice.request('GET', `/v1/songs/${songId}`))
    expect(song.status).toBe('ready')

    // Deleting the song cancels nothing left to cancel here, but removes every object.
    expect((await alice.request('DELETE', `/v1/songs/${songId}`)).status).toBe(204)
    const prefix = analysisPrefix(aliceId, id)
    const deadline = Date.now() + 20_000
    while ((await api.storage.listKeys(prefix)).length > 0) {
      if (Date.now() > deadline) throw new Error('delete_prefix did not remove the objects')
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }, 120_000)

  it('imports a URL, names the song and analyses the download', async () => {
    startWorkers()
    const { song_id, analysis_id } = await json<{ song_id: string; analysis_id: string }>(
      await alice.request('POST', '/v1/songs/import-url', {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        instrument: 'guitar',
        type: 'lite',
        download_video: false,
      }),
    )
    const sse = stream(analysis_id)
    const seen: Event[] = []
    try {
      for await (const event of events(await sse.response)) seen.push(event)
    } finally {
      sse.close()
    }
    const stages = seen.flatMap((e) => (e.type === 'stage.completed' ? [e.stage] : []))
    expect(stages).toEqual(['url_import', 'decode', 'beats', 'chords', 'finalize'])
    expect(seen.at(-1)).toMatchObject({ type: 'analysis.done', status: 'done' })
    const song = await json<{ title: string; status: string; source_kind: string }>(
      await alice.request('GET', `/v1/songs/${song_id}`),
    )
    expect(song).toMatchObject({ title: 'Mock import', status: 'ready', source_kind: 'url' })
  }, 120_000)
})
