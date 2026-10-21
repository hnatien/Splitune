import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  type Analysis,
  analyses,
  artefacts,
  createRepositories,
  jobs,
  type LibraryCursor,
  type LibraryQuery,
  libraryCursor,
  loopClips,
  queue,
  type Song,
  songs,
  stageRuns,
} from '../src/index.ts'
import { createUser, testDb } from './helpers.ts'

const db = testDb(5)
const repo = createRepositories(db)

afterAll(() => db.$client.end())

async function song(userId: string, values: Partial<typeof songs.$inferInsert> = {}) {
  const [row] = await db
    .insert(songs)
    .values({ userId, title: 'Song', sourceKind: 'upload', instrument: 'guitar', ...values })
    .returning()
  return row as Song
}

async function analysis(
  userId: string,
  songId: string,
  values: Partial<typeof analyses.$inferInsert> = {},
) {
  const [row] = await db
    .insert(analyses)
    .values({
      userId,
      songId,
      version: 1,
      pipelineVersion: 'test',
      configProfile: 'personal',
      requestedInstrument: 'guitar',
      analysisType: 'full',
      status: 'running',
      idempotencyKey: randomUUID(),
      ...values,
    })
    .returning()
  return row as Analysis
}

async function stems(userId: string, analysisId: string, expiresAt: Date | null) {
  await db.insert(artefacts).values({
    userId,
    analysisId,
    kind: 'stems',
    version: 1,
    objectKey: `u/${userId}/a/${analysisId}/v1/stems.json`,
    bytes: 10,
    sha256: 'e'.repeat(64),
    modelRefs: [],
    expiresAt,
  })
}

// Every page of a query, following libraryCursor, as titles.
async function allTitles(userId: string, query: Omit<LibraryQuery, 'after'>, limit = 2) {
  const titles: string[] = []
  let after: LibraryCursor | undefined
  for (;;) {
    const page = await repo.songs.library(userId, { ...query, limit, ...(after ? { after } : {}) })
    titles.push(...page.map((e) => e.song.title))
    const last = page.at(-1)
    if (page.length < limit || !last) return titles
    after = libraryCursor(query.sort ?? 'last_practised', last.song)
  }
}

describe('library', () => {
  let erin: string
  beforeAll(async () => {
    erin = await createUser(db)
    const day = (d: number) => new Date(`2026-10-${String(d).padStart(2, '0')}T00:00:00Z`)
    await song(erin, { title: 'beta', createdAt: day(1), lastOpenedAt: day(10), status: 'partial' })
    await song(erin, { title: 'Alpha', createdAt: day(2), instrument: 'bass', status: 'ready' })
    await song(erin, { title: '100%_done', createdAt: day(3), status: 'analysing' })
    await song(erin, { title: 'gamma', createdAt: day(4), lastOpenedAt: day(12), status: 'failed' })
    await song(erin, { title: 'Delta', createdAt: day(5), status: 'importing' })
  })

  it('sorts by last practised, date added and title, paging without gaps or repeats', async () => {
    expect(await allTitles(erin, {})).toEqual(['gamma', 'beta', 'Delta', '100%_done', 'Alpha'])
    expect(await allTitles(erin, { sort: 'added' })).toEqual([
      'Delta',
      'gamma',
      '100%_done',
      'Alpha',
      'beta',
    ])
    expect(await allTitles(erin, { sort: 'title' }, 1)).toEqual([
      '100%_done',
      'Alpha',
      'beta',
      'Delta',
      'gamma',
    ])
  })

  it('filters by title, instrument and status chip', async () => {
    expect(await allTitles(erin, { q: 'ALP' })).toEqual(['Alpha'])
    // LIKE wildcards in the search are literal.
    expect(await allTitles(erin, { q: '%_' })).toEqual(['100%_done'])
    expect(await allTitles(erin, { q: '_' })).toEqual(['100%_done'])
    expect(await allTitles(erin, { instrument: 'bass' })).toEqual(['Alpha'])
    expect(await allTitles(erin, { status: 'analysing', sort: 'title' })).toEqual([
      '100%_done',
      'Delta',
    ])
    expect(await allTitles(erin, { status: 'failed' })).toEqual(['gamma'])
    expect(await allTitles(erin, { status: 'partial' })).toEqual(['beta'])
    expect(await allTitles(erin, { status: 'ready' })).toEqual(['Alpha'])
  })

  it('refuses a cursor of another sort', async () => {
    const [first] = await repo.songs.library(erin, { sort: 'title', limit: 1 })
    if (!first) throw new Error('no song')
    await expect(
      repo.songs.library(erin, { sort: 'added', after: libraryCursor('title', first.song) }),
    ).rejects.toThrow('cursor of another sort')
  })

  it('shows nothing of another user’s library', async () => {
    const frank = await createUser(db)
    expect(await repo.songs.library(frank)).toEqual([])
    expect(await repo.songs.library(frank, { q: 'Alpha' })).toEqual([])
  })

  it('derives progress, recommended view, stems and best clean tempo per card', async () => {
    const gina = await createUser(db)
    const plain = await song(gina, { title: 'plain', createdAt: new Date('2026-01-01Z') })

    // A Lite run reused by a Full upgrade that is still running.
    const upgraded = await song(gina, { title: 'upgraded', createdAt: new Date('2026-01-02Z') })
    const lite = await analysis(gina, upgraded.id, {
      analysisType: 'lite',
      status: 'done',
      recommendedView: 'chords_only',
      createdAt: new Date('2026-02-01Z'),
    })
    for (const stage of ['decode', 'beats', 'chords'] as const) {
      await db
        .insert(stageRuns)
        .values({ analysisId: lite.id, stage, status: 'done', modelRefs: [], cacheKey: 'k' })
    }
    const full = await analysis(gina, upgraded.id, {
      baseAnalysisId: lite.id,
      version: 2,
      createdAt: new Date('2026-02-02Z'),
    })
    await db.insert(jobs).values([
      { kind: 'tag', runner: 'python', analysisId: full.id, status: 'done' },
      { kind: 'separate', runner: 'python', analysisId: full.id, status: 'running' },
      { kind: 'stem_post', runner: 'python', analysisId: full.id },
      { kind: 'finalize', runner: 'node', analysisId: full.id },
    ])

    // A finished Full run whose stems expired, and one whose stems are still there.
    const expired = await song(gina, { title: 'expired', createdAt: new Date('2026-01-03Z') })
    const old = await analysis(gina, expired.id, { status: 'partial', recommendedView: 'tab' })
    await stems(gina, old.id, new Date('2026-03-01Z'))
    const ready = await song(gina, { title: 'ready', createdAt: new Date('2026-01-04Z') })
    const done = await analysis(gina, ready.id, { status: 'done', recommendedView: 'tab' })
    await db.insert(jobs).values([
      { kind: 'decode', runner: 'python', analysisId: done.id, status: 'done' },
      { kind: 'chords', runner: 'python', analysisId: done.id, status: 'failed' },
      { kind: 'notes.guitar', runner: 'python', analysisId: done.id, status: 'cancelled' },
      { kind: 'finalize', runner: 'node', analysisId: done.id, status: 'done' },
      // Not a stage: never counted.
      { kind: 'delete_prefix', runner: 'node', analysisId: done.id, status: 'done' },
    ])
    await stems(gina, done.id, new Date(Date.now() + 86_400_000))
    const clip = {
      userId: gina,
      songId: ready.id,
      startS: 0,
      endS: 2,
      endBeat: 4,
    }
    await db.insert(loopClips).values([
      { ...clip, startBar: 0, endBar: 3, bestCleanTempoPct: 70 },
      { ...clip, startBar: 16, endBar: 19, bestCleanTempoPct: 85 },
      { ...clip, startBar: 4, endBar: 7 },
    ])

    const entries = await repo.songs.library(gina, { sort: 'added' })
    const byTitle = (title: string) => entries.find((e) => e.song.title === title)
    expect(byTitle('plain')).toMatchObject({ latestAnalysis: null, stems: 'none', bestClean: null })
    expect(byTitle('plain')?.song.id).toBe(plain.id)
    expect(byTitle('upgraded')).toMatchObject({
      latestAnalysis: {
        id: full.id,
        type: 'full',
        status: 'running',
        recommendedView: null,
        stagesDone: 3, // decode + beats reused, tag
        stagesTotal: 6,
      },
      // The finished Lite run has no stems.
      stems: 'none',
    })
    expect(byTitle('expired')).toMatchObject({
      latestAnalysis: { status: 'partial', recommendedView: 'tab', stagesDone: 0, stagesTotal: 0 },
      stems: 'expired',
    })
    expect(byTitle('ready')).toMatchObject({
      latestAnalysis: { id: done.id, stagesDone: 4, stagesTotal: 4 },
      stems: 'available',
      bestClean: { tempoPct: 85, startBar: 16, endBar: 19 },
    })
  })
})

describe('stage timings', () => {
  it('reports the median of each stage’s recent successful runs', async () => {
    const hana = await createUser(db)
    const s = await song(hana)
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)
    const durations = [10, 20, 40]
    for (const [i, seconds] of durations.entries()) {
      const a = await analysis(hana, s.id, { version: i + 1 })
      const finishedAt = minutesAgo(i + 1)
      await db.insert(stageRuns).values({
        analysisId: a.id,
        stage: 'lyrics',
        status: i === 2 ? 'fallback' : 'done',
        modelRefs: [],
        cacheKey: 'k',
        startedAt: new Date(finishedAt.getTime() - seconds * 1000),
        finishedAt,
      })
    }
    // Ignored: failed, unfinished and older than the window.
    const ignored = await analysis(hana, s.id, { version: 9 })
    await db.insert(stageRuns).values({
      analysisId: ignored.id,
      stage: 'sections',
      status: 'failed',
      modelRefs: [],
      cacheKey: 'k',
      startedAt: minutesAgo(10),
      finishedAt: minutesAgo(9),
    })
    const stale = await analysis(hana, s.id, { version: 10 })
    await db.insert(stageRuns).values({
      analysisId: stale.id,
      stage: 'f0.vocals',
      status: 'done',
      modelRefs: [],
      cacheKey: 'k',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      finishedAt: new Date('2025-01-01T00:01:00Z'),
    })

    const timings = await queue.stageTimings(db)
    expect(timings.find((t) => t.stage === 'lyrics')).toEqual({
      stage: 'lyrics',
      medianS: 20,
      runs: 3,
    })
    expect(timings.map((t) => t.stage)).not.toContain('sections')
    expect(timings.map((t) => t.stage)).not.toContain('f0.vocals')
  })
})
