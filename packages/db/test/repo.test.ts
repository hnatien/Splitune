import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRepositories } from '../src/index.ts'
import { createUser, seedUserGraph, testDb } from './helpers.ts'

const db = testDb(10)
const repo = createRepositories(db)
let alice: string
let bob: string
let graph: Awaited<ReturnType<typeof seedUserGraph>>

beforeAll(async () => {
  alice = await createUser(db)
  bob = await createUser(db)
  graph = await seedUserGraph(db, alice)
})

afterAll(() => db.$client.end())

describe('songs', () => {
  it('scopes every operation to the user', async () => {
    const song = await repo.songs.create(alice, {
      title: 'Riff',
      sourceKind: 'upload',
      instrument: 'bass',
      durationS: 182.25,
    })
    expect(song).toMatchObject({
      userId: alice,
      status: 'importing',
      durationS: 182.25,
      playerState: {},
    })

    expect(await repo.songs.get(bob, song.id)).toBeUndefined()
    expect(await repo.songs.update(bob, song.id, { title: 'x' })).toBeUndefined()
    expect(await repo.songs.delete(bob, song.id)).toBe(false)
    expect((await repo.songs.list(bob)).map((s) => s.id)).not.toContain(song.id)

    const updated = await repo.songs.update(alice, song.id, {
      lastOpenedAt: new Date(),
      playerState: { speed_pct: 75 },
    })
    expect(updated?.playerState).toEqual({ speed_pct: 75 })
    expect((await repo.songs.list(alice))[0]?.id).toBe(song.id)
    expect(await repo.songs.delete(alice, song.id)).toBe(true)
    expect(await repo.songs.get(alice, song.id)).toBeUndefined()
  })

  it('finds the per-user duplicate by audio hash', async () => {
    const audioHash = 'f'.repeat(64)
    const song = await repo.songs.create(alice, {
      title: 'Dup',
      sourceKind: 'upload',
      instrument: 'guitar',
      audioHash,
    })
    expect((await repo.songs.findByAudioHash(alice, audioHash, 'guitar'))?.id).toBe(song.id)
    expect(await repo.songs.findByAudioHash(alice, audioHash, 'bass')).toBeUndefined()
    expect(await repo.songs.findByAudioHash(bob, audioHash, 'guitar')).toBeUndefined()
  })
})

describe('analyses', () => {
  it('returns the existing run for a repeated idempotency key', async () => {
    const input = {
      songId: graph.song.id,
      version: 2,
      pipelineVersion: 'p1',
      configProfile: 'production',
      requestedInstrument: 'guitar',
      analysisType: 'lite',
      status: 'queued',
      idempotencyKey: randomUUID(),
    } as const
    const first = await repo.analyses.createOrGet(alice, input)
    const second = await repo.analyses.createOrGet(alice, input)
    expect(first.created).toBe(true)
    expect(second).toEqual({ analysis: first.analysis, created: false })
    expect(await repo.analyses.get(bob, first.analysis.id)).toBeUndefined()
  })

  it('cannot start an analysis on another user’s song', async () => {
    await expect(
      repo.analyses.createOrGet(bob, {
        songId: graph.song.id,
        version: 1,
        pipelineVersion: 'p1',
        configProfile: 'production',
        requestedInstrument: 'guitar',
        analysisType: 'full',
        status: 'queued',
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow()
  })
})

describe('artefacts', () => {
  it('lists an analysis’s artefacts for its owner only', async () => {
    const own = await repo.artefacts.listForAnalysis(alice, graph.analysis.id)
    expect(own.map((a) => a.kind)).toContain('beats')
    expect(await repo.artefacts.listForAnalysis(bob, graph.analysis.id)).toEqual([])
    expect(await repo.artefacts.get(bob, graph.artefact.id)).toBeUndefined()
  })
})

describe('corrections', () => {
  it('assigns consecutive revs and skips replayed client op ids', async () => {
    const a = randomUUID()
    const b = randomUUID()
    const first = await repo.corrections.append(alice, graph.artefact.id, [
      { clientOpId: a, op: { op: 'mark_correct', entity_id: 'c1' } },
      { clientOpId: b, op: { op: 'shift_downbeat', by_beats: 1 } },
    ])
    expect(first).toEqual({ rev: 3, applied: [a, b] })

    const replay = await repo.corrections.append(alice, graph.artefact.id, [
      { clientOpId: b, op: { op: 'shift_downbeat', by_beats: 1 } },
    ])
    expect(replay).toEqual({ rev: 3, applied: [] })
    const since = await repo.corrections.listSince(alice, graph.artefact.id, 1)
    expect(since.map((o) => [o.rev, o.clientOpId])).toEqual([
      [2, a],
      [3, b],
    ])
  })

  it('serialises concurrent appends to one artefact', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        repo.corrections.append(alice, graph.artefact.id, [
          { clientOpId: randomUUID(), op: { op: 'mark_correct', entity_id: 'c2' } },
        ]),
      ),
    )
    const revs = results.map((r) => r?.rev).sort((x = 0, y = 0) => x - y)
    expect(revs).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('refuses another user’s artefact', async () => {
    expect(
      await repo.corrections.append(bob, graph.artefact.id, [
        { clientOpId: randomUUID(), op: { op: 'mark_correct', entity_id: 'c1' } },
      ]),
    ).toBeUndefined()
    expect(await repo.corrections.listSince(bob, graph.artefact.id)).toEqual([])
  })
})

describe('loops', () => {
  it('creates, lists, updates and deletes within the user’s song', async () => {
    const loop = await repo.loops.create(alice, graph.song.id, {
      name: 'bridge riff',
      startBar: 4,
      endBar: 8,
      endBeat: 4,
      startS: 9.6,
      endS: 19.2,
    })
    expect(loop).toMatchObject({ restBetween: 'none', countInBars: 1, startBeat: 1 })
    expect((await repo.loops.list(alice, graph.song.id)).map((l) => l.id)).toContain(loop.id)
    expect(await repo.loops.list(bob, graph.song.id)).toEqual([])
    expect(await repo.loops.update(bob, loop.id, { name: 'x' })).toBeUndefined()
    expect((await repo.loops.update(alice, loop.id, { countInBars: 2 }))?.countInBars).toBe(2)
    expect(await repo.loops.delete(bob, loop.id)).toBe(false)
    expect(await repo.loops.delete(alice, loop.id)).toBe(true)
  })

  it('rejects a loop on another user’s song', async () => {
    await expect(
      repo.loops.create(bob, graph.song.id, {
        startBar: 0,
        endBar: 1,
        endBeat: 1,
        startS: 0,
        endS: 1,
      }),
    ).rejects.toThrow()
  })
})

describe('practice sync', () => {
  it('is idempotent and reports already-stored ids as accepted', async () => {
    const clientSessionId = randomUUID()
    const session = {
      clientSessionId,
      songId: graph.song.id,
      startedAt: new Date('2026-10-20T10:00:00Z'),
      inputMode: 'pedal',
    } as const
    expect(await repo.practice.upsertSessions(alice, [session])).toEqual([clientSessionId])
    const ended = new Date('2026-10-20T10:30:00Z')
    expect(await repo.practice.upsertSessions(alice, [{ ...session, endedAt: ended }])).toEqual([
      clientSessionId,
    ])

    const attempt = {
      clientAttemptId: randomUUID(),
      clientSessionId,
      loopClipId: graph.loop.id,
      tempoPct: 85,
      outcome: 'clean',
      at: new Date('2026-10-20T10:05:00Z'),
    } as const
    const orphan = { ...attempt, clientAttemptId: randomUUID(), clientSessionId: randomUUID() }
    expect(await repo.practice.recordAttempts(alice, [attempt, orphan])).toEqual([
      attempt.clientAttemptId,
    ])
    expect(await repo.practice.recordAttempts(alice, [attempt])).toEqual([attempt.clientAttemptId])
  })

  it('ignores sessions for songs the user does not own', async () => {
    expect(
      await repo.practice.upsertSessions(bob, [
        { clientSessionId: randomUUID(), songId: graph.song.id, startedAt: new Date() },
      ]),
    ).toEqual([])
    expect(await repo.practice.upsertSessions(bob, [])).toEqual([])
  })
})

describe('usage', () => {
  it('totals units per kind and period, and refunds failed analyses', async () => {
    const carol = await createUser(db)
    const { analysis } = await seedUserGraph(db, carol)
    await repo.usage.record(carol, { periodStart: '2026-11-01', kind: 'lite_analysis' })
    await repo.usage.record(carol, {
      periodStart: '2026-11-01',
      kind: 'lite_analysis',
      analysisId: analysis.id,
    })
    await repo.usage.record(carol, { periodStart: '2026-10-01', kind: 'welcome_analysis' })

    expect(
      await repo.usage.totals(carol, ['lite_analysis', 'full_analysis'], '2026-11-01'),
    ).toEqual({
      lite_analysis: 2,
      full_analysis: 0,
    })
    // seedUserGraph records one full_analysis in 2026-10.
    expect(await repo.usage.totals(carol, ['welcome_analysis', 'full_analysis'])).toEqual({
      welcome_analysis: 1,
      full_analysis: 1,
    })
    expect(await repo.usage.totals(bob, ['lite_analysis'])).toEqual({ lite_analysis: 0 })

    expect(await repo.usage.refundAnalysis(bob, analysis.id)).toBe(0)
    expect(await repo.usage.refundAnalysis(carol, analysis.id)).toBe(2)
    expect(await repo.usage.totals(carol, ['lite_analysis'], '2026-11-01')).toEqual({
      lite_analysis: 1,
    })
  })
})

describe('users', () => {
  it('reads and updates only the user’s own profile', async () => {
    expect((await repo.users.get(alice))?.handedness).toBe('right')
    const updated = await repo.users.updateProfile(alice, {
      handedness: 'left',
      level: 'returning',
    })
    expect(updated).toMatchObject({ handedness: 'left', level: 'returning' })
    expect(await repo.users.get('nobody')).toBeUndefined()
  })
})
