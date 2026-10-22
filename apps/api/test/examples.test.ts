import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Example } from '@splitune/contracts'
import type { ExamplesManifest } from '@splitune/contracts/examples-manifest'
import { exampleKey } from '@splitune/storage'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { type Caller, caller, createTestApi, sha256Hex, signIn } from './helpers.ts'

// Example songs (13 §1): visitors list them and get signed URLs for their documents and stems
// without a session; a signed-in user claims one with the progress their device kept, and a
// replay of the claim changes nothing. Product events (16 §2) from visitors and users.

const FIXTURES = join(import.meta.dirname, '../../../packages/contracts/fixtures')
const BUILD = '20261022T153000Z'
const id = `riff-${randomUUID().slice(0, 8)}`
const artefactIds = { beats: randomUUID(), chords: randomUUID(), stems: randomUUID() }

const manifest: z.infer<typeof ExamplesManifest> = {
  version: 1,
  examples: [
    {
      id,
      build: BUILD,
      title: 'Ill Fate',
      artist: 'Hollow Ground',
      instrument: 'guitar',
      part: 'riff',
      duration_s: 20.5,
      audio_hash: sha256Hex(id),
      song_id: randomUUID(),
      analysis: {
        id: randomUUID(),
        pipeline_version: 'test',
        recommended_view: 'tab',
        stages: { beats: { status: 'done' } },
        created_at: '2026-10-22T15:28:00Z',
        finished_at: '2026-10-22T15:30:00Z',
      },
      artefacts: (['beats', 'chords', 'stems'] as const).map((kind) => ({
        id: artefactIds[kind],
        kind,
        version: 1,
        path: `${kind}.json`,
        bytes: 100,
        sha256: sha256Hex(kind),
        model_refs: [],
      })),
      loop: { start_bar: 2, end_bar: 5 },
      speed_pct: { just_started: 70, few_songs: 80, returning: 80 },
    },
  ],
}

const dir = mkdtempSync(join(tmpdir(), 'splitune-examples-'))
const manifestPath = join(dir, 'examples.json')
writeFileSync(manifestPath, JSON.stringify(manifest))
const api = createTestApi({ EXAMPLES_MANIFEST: manifestPath })
const anonymous = caller(api)
let alice: Caller

const json = async <T>(res: Response) => (await res.json()) as T
const key = (path: string) => exampleKey(id, BUILD, path)

beforeAll(async () => {
  for (const kind of ['beats', 'chords', 'stems']) {
    await api.storage.putBytes(
      key(`${kind}.json`),
      readFileSync(join(FIXTURES, `${kind}.json`)),
      'application/json',
    )
  }
  await api.storage.putBytes(key('stems/guitar.m4a'), new Uint8Array([1, 2, 3]), 'audio/mp4')
  alice = caller(api, await signIn(api))
})

afterAll(() => api.close())

describe('examples for visitors', () => {
  it('lists each example as a ready song with its finished analysis', async () => {
    const res = await anonymous.request('GET', '/v1/examples')
    expect(res.status).toBe(200)
    const { items } = await json<{ items: unknown[] }>(res)
    const [example] = items.map((item) => Example.parse(item))
    expect(example).toMatchObject({ id, part: 'riff', loop: { start_bar: 2, end_bar: 5 } })
    expect(example?.song).toMatchObject({
      source_kind: 'example',
      status: 'ready',
      latest_analysis: { status: 'done', type: 'full' },
    })
    expect(example?.song.artefacts.map((a) => a.id).sort()).toEqual(
      Object.values(artefactIds).sort(),
    )
  })

  it('signs documents and stems inside the build, and nothing else', async () => {
    const doc = await anonymous.request(
      'GET',
      `/v1/examples/${id}/url?artefact_id=${artefactIds.beats}`,
    )
    expect(doc.status).toBe(200)
    const { url } = await json<{ url: string }>(doc)
    expect(new URL(url).pathname).toContain(key('beats.json'))
    expect((await fetch(url)).status).toBe(200)

    const stem = await anonymous.request(
      'GET',
      `/v1/examples/${id}/url?artefact_id=${artefactIds.stems}&stem_id=guitar`,
    )
    expect(stem.status).toBe(200)
    const audio = await fetch((await json<{ url: string }>(stem)).url)
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))

    for (const path of [
      `/v1/examples/${id}/url?artefact_id=${randomUUID()}`,
      `/v1/examples/nope/url?artefact_id=${artefactIds.beats}`,
      `/v1/examples/${id}/url?artefact_id=${artefactIds.stems}&stem_id=vocals`,
    ]) {
      expect((await anonymous.request('GET', path)).status).toBe(404)
    }
  })
})

describe('claiming an example', () => {
  const loopId = randomUUID()
  const sessionId = randomUUID()
  const attemptId = randomUUID()
  const opId = randomUUID()
  const progress = {
    level: 'just_started',
    player_state: { speed_pct: 70, selected_loop_id: loopId },
    loops: [
      {
        id: loopId,
        start_bar: 2,
        start_beat: 1,
        end_bar: 5,
        end_beat: 4,
        start_s: 4.8,
        end_s: 14.4,
      },
    ],
    sessions: [
      {
        client_session_id: sessionId,
        started_at: '2026-10-22T16:00:00Z',
        ended_at: '2026-10-22T16:05:00Z',
        input_mode: 'touch',
      },
    ],
    attempts: [
      {
        client_attempt_id: attemptId,
        client_session_id: sessionId,
        loop_clip_id: loopId,
        tempo_pct: 70,
        outcome: 'clean',
        at: '2026-10-22T16:01:00Z',
      },
    ],
    corrections: [
      {
        kind: 'chords',
        ops: [{ client_op_id: opId, op: { op: 'report_wrong', entity_id: 'c1' } }],
      },
    ],
  }

  it('needs a session', async () => {
    const res = await anonymous.request('POST', `/v1/examples/${id}/claim`, progress)
    expect(res.status).toBe(401)
  })

  it('adds the example with the visitor’s loop, pass and edit, and the profile defaults', async () => {
    const res = await alice.request('POST', `/v1/examples/${id}/claim`, progress)
    expect(res.status).toBe(200)
    const { song_id } = await json<{ song_id: string }>(res)

    const song = await json<{
      source_kind: string
      player_state: unknown
      artefacts: { id: string; kind: string }[]
    }>(await alice.request('GET', `/v1/songs/${song_id}`))
    expect(song.source_kind).toBe('example')
    expect(song.player_state).toEqual(progress.player_state)

    const loops = await json<{ items: { id: string; best_clean_tempo_pct: number | null }[] }>(
      await alice.request('GET', `/v1/songs/${song_id}/loops`),
    )
    expect(loops.items).toEqual([expect.objectContaining({ id: loopId, best_clean_tempo_pct: 70 })])

    const chords = song.artefacts.find((a) => a.kind === 'chords')
    const ops = await json<{ ops: { client_op_id: string }[] }>(
      await alice.request('GET', `/v1/artefacts/${chords?.id}/corrections`),
    )
    expect(ops.ops.map((o) => o.client_op_id)).toEqual([opId])

    // The claimed song's stems are the shared example objects.
    const stems = song.artefacts.find((a) => a.kind === 'stems')
    const signed = await alice.request('GET', `/v1/artefacts/${stems?.id}/url?stem_id=guitar`)
    expect(signed.status).toBe(200)

    const me = await json<{ primary_instrument: string; level: string }>(
      await alice.request('GET', '/v1/me'),
    )
    expect(me).toMatchObject({ primary_instrument: 'guitar', level: 'just_started' })

    // A replay (second tab, retried request) returns the same song and stores nothing twice.
    const again = await alice.request('POST', `/v1/examples/${id}/claim`, progress)
    expect((await json<{ song_id: string }>(again)).song_id).toBe(song_id)
    const progressOut = await json<{ clips: { attempts: unknown[] }[] }>(
      await alice.request('GET', `/v1/progress?song_id=${song_id}`),
    )
    expect(progressOut.clips.map((c) => c.attempts.length)).toEqual([1])
    const library = await json<{ items: { id: string }[] }>(await alice.request('GET', '/v1/songs'))
    expect(library.items.filter((s) => s.id === song_id)).toHaveLength(1)
  })

  it('answers 404 for an example that does not exist', async () => {
    const res = await alice.request('POST', '/v1/examples/nope/claim', progress)
    expect(res.status).toBe(404)
  })
})

describe('product events', () => {
  it('stores a visitor’s and a user’s events and refuses unknown ones', async () => {
    const exampleId = `e-${randomUUID().slice(0, 8)}`
    const event = { name: 'example_song_opened', props: { example_id: exampleId } }
    expect((await anonymous.request('POST', '/v1/events', { events: [event] })).status).toBe(204)
    expect((await alice.request('POST', '/v1/events', { events: [event] })).status).toBe(204)
    const { rows } = await api.db.$client.query(
      `select user_id from analytics_events where props->>'example_id' = $1 order by id`,
      [exampleId],
    )
    expect(rows.map((r) => (r as { user_id: string | null }).user_id === null)).toEqual([
      true,
      false,
    ])
    const unknown = await anonymous.request('POST', '/v1/events', {
      events: [{ name: 'song_title_seen', props: { title: 'x' } }],
    })
    expect(unknown.status).toBe(400)
  })
})
