import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import {
  analyses,
  analyticsEvents,
  artefacts,
  auditLog,
  authSessions,
  createDb,
  createRepositories,
  DELETE_ACCOUNT_JOB,
  dataExports,
  EXPORT_JOB,
  jobs,
  queue,
  rateLimits,
  revokeSessions,
  songs,
  stageRuns,
  users,
  youtubeRefs,
} from '../src/index.ts'
import {
  asRole,
  createUser,
  INSUFFICIENT_PRIVILEGE,
  pgErrorCode,
  seedUserGraph,
  testDb,
} from './helpers.ts'

const { lifecycle } = queue
const db = testDb(3)
const repos = createRepositories(db)

// Lifecycle code runs as maintenance; the URL's options switch the session's role like a login.
const maintenanceUrl = new URL(inject('databaseUrl'))
maintenanceUrl.searchParams.set('options', '-c role=maintenance')
const maintenance = createDb({ url: maintenanceUrl.toString(), max: 2 })

afterAll(async () => {
  await maintenance.$client.end()
  await db.$client.end()
})

const DAY = 86_400_000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY)

async function songWithStems(
  userId: string,
  { lastOpened, stemsMade, key }: { lastOpened: Date | null; stemsMade: Date; key?: string },
) {
  const [song] = await db
    .insert(songs)
    .values({
      userId,
      title: 'Song',
      sourceKind: 'upload',
      instrument: 'guitar',
      lastOpenedAt: lastOpened,
      createdAt: daysAgo(400),
      status: 'ready',
    })
    .returning()
  if (!song) throw new Error('seed failed')
  const [analysis] = await db
    .insert(analyses)
    .values({
      userId,
      songId: song.id,
      version: 1,
      pipelineVersion: 'test',
      configProfile: 'production',
      requestedInstrument: 'guitar',
      analysisType: 'full',
      status: 'done',
      idempotencyKey: randomUUID(),
    })
    .returning()
  if (!analysis) throw new Error('seed failed')
  const [stems] = await db
    .insert(artefacts)
    .values({
      userId,
      analysisId: analysis.id,
      kind: 'stems',
      version: 1,
      objectKey: key ?? `u/${userId}/a/${analysis.id}/v1/stems.json`,
      bytes: 10,
      sha256: 'e'.repeat(64),
      modelRefs: [],
      createdAt: stemsMade,
    })
    .returning()
  if (!stems) throw new Error('seed failed')
  return { song, analysis, stems }
}

describe('scheduled runs', () => {
  it('claims a run once per due time, across callers', async () => {
    const name = `test-${randomUUID()}`
    const due = new Date()
    const claims = await Promise.all(
      Array.from({ length: 5 }, () => lifecycle.claimScheduledRun(maintenance, name, due)),
    )
    expect(claims.filter(Boolean)).toHaveLength(1)
    expect(await lifecycle.claimScheduledRun(maintenance, name, due)).toBe(false)
    await lifecycle.finishScheduledRun(maintenance, name, { status: 'done', result: { n: 1 } })
    // The next due time is after the last start: claimable again.
    expect(await lifecycle.claimScheduledRun(maintenance, name, new Date(Date.now() + 1000))).toBe(
      true,
    )
    const [row] = (await lifecycle.scheduledRuns(maintenance)).filter((r) => r.name === name)
    expect(row).toMatchObject({ lastStatus: 'done', lastResult: { n: 1 } })
  })
})

describe('stems sweeper', () => {
  let user: string
  let stale: Awaited<ReturnType<typeof songWithStems>>
  let neverOpened: Awaited<ReturnType<typeof songWithStems>>
  let recent: Awaited<ReturnType<typeof songWithStems>>
  let recreated: Awaited<ReturnType<typeof songWithStems>>
  let example: Awaited<ReturnType<typeof songWithStems>>

  beforeAll(async () => {
    user = await createUser(db)
    stale = await songWithStems(user, { lastOpened: daysAgo(200), stemsMade: daysAgo(300) })
    neverOpened = await songWithStems(user, { lastOpened: null, stemsMade: daysAgo(300) })
    recent = await songWithStems(user, { lastOpened: daysAgo(10), stemsMade: daysAgo(300) })
    // Re-created yesterday on a song nobody opened for 200 days.
    recreated = await songWithStems(user, { lastOpened: daysAgo(200), stemsMade: daysAgo(1) })
    example = await songWithStems(user, {
      lastOpened: daysAgo(200),
      stemsMade: daysAgo(300),
      key: 'assets/examples/riff/20261022T090536Z/stems.json',
    })
  })

  it('selects only stems inactive for the window, never shared example files', async () => {
    const candidates = await lifecycle.stemsToSweep(maintenance, {
      inactiveBefore: daysAgo(180),
      limit: 1000,
    })
    const mine = candidates.filter((c) => c.userId === user).map((c) => c.artefactId)
    expect(mine.sort()).toEqual([stale.stems.id, neverOpened.stems.id].sort())
    expect(mine).not.toContain(recent.stems.id)
    expect(mine).not.toContain(recreated.stems.id)
    expect(mine).not.toContain(example.stems.id)
  })

  it('marks a sweep once, audits it and stops selecting it', async () => {
    const candidate = (
      await lifecycle.stemsToSweep(maintenance, { inactiveBefore: daysAgo(180), limit: 1000 })
    ).find((c) => c.artefactId === stale.stems.id)
    if (!candidate) throw new Error('missing candidate')
    expect(
      await lifecycle.markStemsPurged(maintenance, candidate, { objects: 2, bytes: 2048 }),
    ).toBe(true)
    expect(await lifecycle.markStemsPurged(maintenance, candidate, { objects: 0, bytes: 0 })).toBe(
      false,
    )
    const after = await lifecycle.stemsToSweep(maintenance, {
      inactiveBefore: daysAgo(180),
      limit: 1000,
    })
    expect(after.map((c) => c.artefactId)).not.toContain(stale.stems.id)
    const [row] = await db.select().from(artefacts).where(eq(artefacts.id, stale.stems.id))
    expect(row?.purgedAt).toBeInstanceOf(Date)
    const entries = await db
      .select()
      .from(auditLog)
      .where(sql`${auditLog.subject} ->> 'artefact_id' = ${stale.stems.id}`)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ actor: 'lifecycle', action: 'stems.swept' })
    // The library now reports the song's stems as expired.
    const page = await repos.songs.library(user, { limit: 50 })
    expect(page.find((e) => e.song.id === stale.song.id)?.stems).toBe('expired')
  })
})

describe('raw uploads and YouTube data', () => {
  it('expires uploads past their date once', async () => {
    const user = await createUser(db)
    await seedUserGraph(db, user)
    await db.execute(
      sql`update uploads set expires_at = now() - interval '1 day' where user_id = ${user}`,
    )
    const due = (
      await lifecycle.uploadsToExpire(maintenance, { now: new Date(), limit: 100 })
    ).filter((u) => u.userId === user)
    expect(due).toHaveLength(1)
    const upload = due[0] as (typeof due)[number]
    expect(await lifecycle.markUploadExpired(maintenance, upload)).toBe(true)
    expect(await lifecycle.markUploadExpired(maintenance, upload)).toBe(false)
    expect(
      (await lifecycle.uploadsToExpire(maintenance, { now: new Date(), limit: 100 })).some(
        (u) => u.userId === user,
      ),
    ).toBe(false)
  })

  it('nulls fetched titles older than the window only', async () => {
    const user = await createUser(db)
    await seedUserGraph(db, user)
    const [ref] = await db.select().from(youtubeRefs).where(eq(youtubeRefs.userId, user))
    if (!ref) throw new Error('seed failed')
    await db
      .update(youtubeRefs)
      .set({ fetchedTitle: 'Some title', apiDataRefreshedAt: daysAgo(31) })
      .where(eq(youtubeRefs.songId, ref.songId))
    expect(await lifecycle.nullStaleYoutubeTitles(maintenance, daysAgo(30))).toBeGreaterThanOrEqual(
      1,
    )
    const [after] = await db.select().from(youtubeRefs).where(eq(youtubeRefs.songId, ref.songId))
    expect(after?.fetchedTitle).toBeNull()
    expect(await lifecycle.nullStaleYoutubeTitles(maintenance, daysAgo(30))).toBe(0)
  })
})

describe('privacy requests', () => {
  it('records one pending export at a time and enqueues its job', async () => {
    const user = await createUser(db)
    const key = (id: string) => `u/${user}/exports/${id}.json`
    const [first, second] = await Promise.all([
      repos.privacy.requestExport(user, key),
      repos.privacy.requestExport(user, key),
    ])
    expect(second?.id).toBe(first?.id)
    expect(first).toMatchObject({ status: 'pending', objectKey: key(first?.id ?? '') })
    const queued = await db.select().from(jobs).where(eq(jobs.kind, EXPORT_JOB))
    expect(queued.filter((j) => (j.payload as { user_id?: string }).user_id === user)).toHaveLength(
      1,
    )
    expect((await repos.privacy.latestExport(user))?.id).toBe(first?.id)
  })

  it('marks an account for deletion once and enqueues its purge', async () => {
    const user = await createUser(db)
    const at = await repos.privacy.requestDeletion(user)
    expect(at).toBeInstanceOf(Date)
    expect((await repos.privacy.requestDeletion(user))?.getTime()).toBe(at?.getTime())
    const queued = await db.select().from(jobs).where(eq(jobs.kind, DELETE_ACCOUNT_JOB))
    expect(queued.filter((j) => (j.payload as { user_id?: string }).user_id === user)).toHaveLength(
      1,
    )
    const [row] = await db.select().from(users).where(eq(users.id, user))
    expect(row?.deletedAt).toBeInstanceOf(Date)
  })

  it('refuses account jobs for another user', async () => {
    const alice = await createUser(db)
    const bob = await createUser(db)
    const code = await pgErrorCode(
      db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.user_id', ${alice}, true)`)
        await tx.execute(sql`set local role app`)
        await queue.enqueue(tx, DELETE_ACCOUNT_JOB, 'node', { user_id: bob })
      }),
    )
    expect(code).toBe(INSUFFICIENT_PRIVILEGE)
  })
})

describe('account purge', () => {
  it('leaves no row of the user except the audit log', async () => {
    const user = await createUser(db)
    const other = await createUser(db)
    await seedUserGraph(db, user)
    await seedUserGraph(db, other)
    const hash = `hash-${user}`
    await db.insert(analyticsEvents).values({ userHash: hash, name: 'speed_changed' })
    await db
      .insert(rateLimits)
      .values({ key: `uploads:user:${user}`, windowStart: new Date(), count: 1 })
    await db.insert(authSessions).values({
      id: randomUUID(),
      userId: user,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + DAY),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await repos.privacy.requestExport(user, (id) => `u/${user}/exports/${id}.json`)
    await repos.privacy.requestDeletion(user)
    const [job] = await db
      .select()
      .from(jobs)
      .where(sql`${jobs.kind} = ${DELETE_ACCOUNT_JOB} and ${jobs.payload} ->> 'user_id' = ${user}`)
    if (!job) throw new Error('no delete job')

    expect(await revokeSessions(db, user)).toBe(1)
    expect(await lifecycle.hasRunningJobs(maintenance, user)).toBe(false)
    const result = await lifecycle.purgeUserRows(maintenance, {
      userId: user,
      userHash: hash,
      jobId: job.id,
      objects: 7,
    })
    // The seeded event and the one above.
    expect(result).toEqual({ users: 1, events: 2 })
    await lifecycle.scrubJobPayload(maintenance, job.id)

    // Every column of every table that could hold the id, compared as text.
    const columns = await db.execute<{ table_name: string; column_name: string }>(sql`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public' and data_type in ('text', 'jsonb', 'ARRAY', 'USER-DEFINED')
        and table_name <> 'audit_log'`)
    const leftovers: string[] = []
    for (const { table_name, column_name } of columns.rows) {
      const found = await db.execute<{ n: number }>(
        sql`select count(*)::int as n from ${sql.identifier(table_name)}
            where ${sql.identifier(column_name)}::text like ${`%${user}%`}`,
      )
      if ((found.rows[0]?.n ?? 0) > 0) leftovers.push(`${table_name}.${column_name}`)
    }
    expect(leftovers).toEqual([])
    expect(
      await db.select().from(analyticsEvents).where(eq(analyticsEvents.userHash, hash)),
    ).toEqual([])
    const audits = await db.select().from(auditLog).where(eq(auditLog.subjectUserId, user))
    expect(audits.map((a) => a.action)).toContain('account.deleted')
    // The other user is untouched.
    expect(await db.select().from(songs).where(eq(songs.userId, other))).toHaveLength(1)
    // A second purge (a retried job) finds nothing and still succeeds.
    expect(
      await lifecycle.purgeUserRows(maintenance, {
        userId: user,
        userHash: hash,
        jobId: job.id,
        objects: 0,
      }),
    ).toEqual({ users: 0, events: 0 })
  })

  it('sees running analysis jobs of the user', async () => {
    const user = await createUser(db)
    const { analysis } = await songWithStems(user, { lastOpened: null, stemsMade: new Date() })
    await db
      .insert(jobs)
      .values({ kind: 'separate', runner: 'python', analysisId: analysis.id, status: 'running' })
    expect(await lifecycle.hasRunningJobs(maintenance, user)).toBe(true)
  })
})

describe('data export rows', () => {
  it('reads everything of one user in one snapshot', async () => {
    const user = await createUser(db)
    await seedUserGraph(db, user)
    const rows = await lifecycle.exportRows(maintenance, user)
    expect(rows?.user.id).toBe(user)
    expect(rows?.songs).toHaveLength(1)
    expect(rows?.analyses).toHaveLength(1)
    expect(rows?.uploads).toHaveLength(1)
    expect(rows?.loops).toHaveLength(1)
    expect(rows?.corrections).toHaveLength(1)
    expect(rows?.sessions).toHaveLength(1)
    expect(rows?.attempts).toHaveLength(1)
    expect(rows?.subscription?.plan).toBe('paid_monthly')
    expect(await lifecycle.exportRows(maintenance, 'nobody')).toBeUndefined()
  })

  it('finishes an export once and expires it after its date', async () => {
    const user = await createUser(db)
    const row = await repos.privacy.requestExport(user, (id) => `u/${user}/exports/${id}.json`)
    await lifecycle.finishExport(maintenance, row, {
      status: 'ready',
      bytes: 123,
      expiresAt: new Date(Date.now() - 1000),
    })
    const due = (await lifecycle.exportsToExpire(maintenance, new Date())).map((r) => r.id)
    expect(due).toContain(row.id)
    await lifecycle.markExportExpired(maintenance, row.id)
    const [after] = await db.select().from(dataExports).where(eq(dataExports.id, row.id))
    expect(after).toMatchObject({ status: 'expired', bytes: 123 })
  })
})

describe('analysis telemetry', () => {
  it('records stage and done events under the user hash, as node_worker', async () => {
    const user = await createUser(db)
    const { analysis } = await songWithStems(user, { lastOpened: null, stemsMade: new Date() })
    const started = new Date(Date.now() - 5000)
    await db
      .update(analyses)
      .set({ finishedAt: new Date(), recommendedView: 'tab' })
      .where(eq(analyses.id, analysis.id))
    await db.insert(stageRuns).values([
      {
        analysisId: analysis.id,
        stage: 'beats',
        status: 'done',
        modelRefs: [
          {
            model_id: 'beat_this/final0',
            version: '1.1.0',
            weights_sha256: 'a'.repeat(64),
            provider: 'self_hosted',
            register_tier: 'green',
          },
        ],
        cacheKey: 'k1',
        startedAt: started,
        finishedAt: new Date(started.getTime() + 2000),
      },
      {
        analysisId: analysis.id,
        stage: 'chords',
        status: 'fallback',
        modelRefs: [],
        cacheKey: 'k2',
      },
    ])
    const n = await asRole(db, 'node_worker', (tx) =>
      queue.recordAnalysisTelemetry(tx, analysis.id, (id) => `h:${id.length}`),
    )
    expect(n).toBe(3)
    const rows = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.userHash, `h:${user.length}`))
    const done = rows.find((r) => r.name === 'analysis_done')
    expect(done?.props).toMatchObject({
      status: 'done',
      fallback_stages: ['chords'],
      recommended_view: 'tab',
    })
    const beats = rows.find(
      (r) =>
        r.name === 'analysis_stage_completed' && (r.props as { stage?: string }).stage === 'beats',
    )
    expect(beats?.props).toEqual({
      stage: 'beats',
      status: 'done',
      duration_ms: 2000,
      model_ref: 'beat_this/final0@1.1.0',
    })
  })
})
