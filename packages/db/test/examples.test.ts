import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  analyticsEvents,
  createRepositories,
  type ExampleCopy,
  loopClips,
  withUser,
} from '../src/index.ts'
import {
  createUser,
  INSUFFICIENT_PRIVILEGE,
  pgErrorCode,
  seedUserGraph,
  testDb,
} from './helpers.ts'

const db = testDb(5)
const repo = createRepositories(db)
let alice: string
let bob: string

const prefix = 'assets/examples/ill-fate/20261022T153000Z/'
const copy = (audioHash: string): ExampleCopy => ({
  title: 'Ill Fate',
  artist: 'Hollow Ground',
  instrument: 'guitar',
  durationS: 30,
  audioHash,
  analysis: {
    pipelineVersion: 'test',
    configProfile: 'personal',
    recommendedView: 'tab',
    idempotencyKey: `example:ill-fate:${audioHash}`,
    finishedAt: new Date('2026-10-22T15:30:00Z'),
  },
  artefacts: ['beats', 'chords', 'stems', 'summary'].map((kind) => ({
    kind,
    version: 1,
    objectKey: `${prefix}${kind}.json`,
    bytes: 10,
    sha256: 'e'.repeat(64),
    modelRefs: [],
  })),
})

const loop = (id: string) => ({
  id,
  name: null,
  startBar: 4,
  startBeat: 1,
  endBar: 7,
  endBeat: 4,
  startS: 9.6,
  endS: 19.2,
})

beforeAll(async () => {
  alice = await createUser(db)
  bob = await createUser(db)
})

afterAll(() => db.$client.end())

describe('examples.claim', () => {
  it('gives the user a ready example song with shared artefacts, once', async () => {
    const hash = randomUUID().replaceAll('-', '').padEnd(64, '0')
    const loopId = randomUUID()
    const first = await repo.examples.claim(alice, copy(hash), {
      playerState: { speed_pct: 70 },
      loops: [loop(loopId)],
    })
    expect(first.created).toBe(true)
    expect(first.song).toMatchObject({
      userId: alice,
      sourceKind: 'example',
      status: 'ready',
      title: 'Ill Fate',
      playerState: { speed_pct: 70 },
    })
    expect([...first.artefactIds.keys()].sort()).toEqual(['beats', 'chords', 'stems', 'summary'])

    const opened = await repo.songs.open(alice, first.song.id)
    expect(opened?.latestAnalysis?.status).toBe('done')
    const artefact = await repo.artefacts.get(alice, first.artefactIds.get('beats') ?? '')
    expect(artefact).toMatchObject({ objectKey: `${prefix}beats.json`, expiresAt: null })

    // A replay (another tab, a retried request) finds the same song and adds nothing.
    const again = await repo.examples.claim(alice, copy(hash), {
      playerState: { speed_pct: 90 },
      loops: [loop(loopId)],
    })
    expect(again.created).toBe(false)
    expect(again.song.id).toBe(first.song.id)
    expect(again.song.playerState).toEqual({ speed_pct: 70 })
    expect(again.artefactIds).toEqual(first.artefactIds)
    expect((await repo.loops.list(alice, first.song.id)).map((l) => l.id)).toEqual([loopId])
  })

  it("never takes over another user's loop id", async () => {
    const hash = randomUUID().replaceAll('-', '').padEnd(64, '1')
    const loopId = randomUUID()
    const bobs = await repo.examples.claim(bob, copy(hash), {
      playerState: {},
      loops: [loop(loopId)],
    })
    const alices = await repo.examples.claim(alice, copy(hash), {
      playerState: {},
      loops: [loop(loopId)],
    })
    expect(await repo.loops.list(alice, alices.song.id)).toEqual([])
    const [row] = await db.select().from(loopClips).where(eq(loopClips.id, loopId))
    expect(row?.songId).toBe(bobs.song.id)
  })

  it('app may insert artefact rows only under assets/examples/', async () => {
    const graph = await seedUserGraph(db, alice)
    const insert = (key: string) =>
      withUser(db, alice, (tx) =>
        tx.execute(sql`
          insert into artefacts (user_id, analysis_id, kind, version, object_key, bytes, sha256, model_refs)
          values (${alice}, ${graph.analysis.id}, 'chords', 9, ${key}, 1, ${'f'.repeat(64)}, '[]')`),
      )
    expect(await pgErrorCode(insert(`u/${bob}/a/x/v1/chords.json`))).toBe(INSUFFICIENT_PRIVILEGE)
    await insert(`${prefix}chords.json`)
  })
})

describe('analytics.record', () => {
  it("stores a visitor's events without a user and a user's with theirs", async () => {
    const name = `test_${randomUUID()}`
    await repo.analytics.record(null, [{ name, props: { step: 'instrument' } }])
    await repo.analytics.record(alice, [{ name, props: { step: 'level' } }])
    const rows = await db.select().from(analyticsEvents).where(eq(analyticsEvents.name, name))
    expect(rows.map((r) => [r.userId, r.props])).toEqual([
      [null, { step: 'instrument' }],
      [alice, { step: 'level' }],
    ])
  })
})
