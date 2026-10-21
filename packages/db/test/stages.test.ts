import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  analyses,
  artefacts,
  jobEvents,
  jobs,
  queue,
  stageRuns,
  workerHeartbeats,
} from '../src/index.ts'
import { asRole, createUser, seedUserGraph, testDb } from './helpers.ts'

const { claim, enqueue, finishStage, loadAnalysis, markStageStarted, recordStageFailure } = queue
const db = testDb(4)

let alice: string
let analysisId: string

beforeAll(async () => {
  alice = await createUser(db)
  analysisId = (await seedUserGraph(db, alice)).analysis.id
})

beforeEach(async () => {
  await db.delete(jobs)
  await db.delete(jobEvents)
  await db.delete(stageRuns).where(eq(stageRuns.stage, 'finalize'))
  await db.update(analyses).set({ status: 'running', progress: 0, finishedAt: null })
})

afterAll(() => db.$client.end())

const eventsOf = async () =>
  (await db.select().from(jobEvents).where(eq(jobEvents.analysisId, analysisId))).map(
    (e) => e.event,
  )

async function claimedFinalize() {
  await enqueue(db, 'finalize', 'node', {}, { analysisId })
  const job = await asRole(db, 'node_worker', (tx) => claim(tx, 'node', 'mac:node'))
  if (!job) throw new Error('nothing claimed')
  const analysis = await asRole(db, 'node_worker', (tx) => loadAnalysis(tx, analysisId))
  if (!analysis) throw new Error('analysis missing')
  return { job, analysis }
}

const summary = (key: string) => ({
  kind: 'summary',
  key,
  sha256: 'd'.repeat(64),
  bytes: 42,
})

describe('stage bookkeeping as node_worker', () => {
  it('records artefacts, stage run, events and the analysis end state with complete', async () => {
    const { job, analysis } = await claimedFinalize()
    await asRole(db, 'node_worker', (tx) => markStageStarted(tx, job, analysis, 'finalize'))
    const key = `u/${alice}/a/${analysisId}/v1/summary.json`
    const ok = await asRole(db, 'node_worker', (tx) =>
      finishStage(tx, {
        job,
        workerId: 'mac:node',
        analysis,
        stage: 'finalize',
        status: 'done',
        written: [summary(key)],
        modelRefs: [],
        primaryKind: 'summary',
        analysisDone: { status: 'partial', summaryKind: 'summary', recommendedView: 'chords_only' },
      }),
    )
    expect(ok).toBe(true)
    const [row] = await db
      .select()
      .from(artefacts)
      .where(and(eq(artefacts.analysisId, analysisId), eq(artefacts.kind, 'summary')))
    expect(row).toMatchObject({ objectKey: key, bytes: 42, version: 1, userId: alice })
    const [run] = await db
      .select()
      .from(stageRuns)
      .where(and(eq(stageRuns.analysisId, analysisId), eq(stageRuns.stage, 'finalize')))
    expect(run?.status).toBe('done')
    expect(run?.finishedAt).not.toBeNull()
    const [done] = await db.select().from(analyses).where(eq(analyses.id, analysisId))
    expect(done).toMatchObject({ status: 'partial', progress: 1, recommendedView: 'chords_only' })
    const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, job.id))
    expect(jobRow?.status).toBe('done')
    const events = await eventsOf()
    expect(events.map((e) => e.type)).toEqual(['stage.started', 'stage.completed', 'analysis.done'])
    expect(events[1]).toMatchObject({ artefact: { id: row?.id, kind: 'summary', version: 1 } })
    expect(events[2]).toEqual({
      type: 'analysis.done',
      status: 'partial',
      summary_artefact_id: row?.id,
    })
  })

  it('rolls everything back when the lock was lost', async () => {
    const { job, analysis } = await claimedFinalize()
    await asRole(db, 'node_worker', (tx) => markStageStarted(tx, job, analysis, 'finalize'))
    await db.update(jobs).set({ status: 'queued', lockedBy: null }).where(eq(jobs.id, job.id))
    const ok = await asRole(db, 'node_worker', (tx) =>
      finishStage(tx, {
        job,
        workerId: 'mac:node',
        analysis,
        stage: 'finalize',
        status: 'done',
        written: [summary(`u/${alice}/a/${analysisId}/v1/summary.json`)],
        modelRefs: [],
        primaryKind: 'summary',
        analysisDone: { status: 'done', summaryKind: 'summary' },
      }),
    )
    expect(ok).toBe(false)
    const [row] = await db.select().from(analyses).where(eq(analyses.id, analysisId))
    expect(row?.status).toBe('running')
    expect((await eventsOf()).map((e) => e.type)).toEqual(['stage.started'])
  })

  it('marks a retry pending and a permanent finalize failure as a failed analysis', async () => {
    const { job, analysis } = await claimedFinalize()
    await asRole(db, 'node_worker', (tx) => markStageStarted(tx, job, analysis, 'finalize'))
    const retry = await asRole(db, 'node_worker', (tx) =>
      recordStageFailure(tx, job, 'mac:node', analysis, 'finalize', 'internal_error', {
        retry: true,
      }),
    )
    expect(retry).toBe('queued')
    const [pending] = await db
      .select()
      .from(stageRuns)
      .where(and(eq(stageRuns.analysisId, analysisId), eq(stageRuns.stage, 'finalize')))
    expect(pending).toMatchObject({ status: 'pending', errorCode: 'internal_error' })

    await db.update(jobs).set({ runAfter: sql`now()` }).where(eq(jobs.id, job.id))
    const again = await asRole(db, 'node_worker', (tx) => claim(tx, 'node', 'mac:node'))
    if (!again) throw new Error('nothing claimed')
    const final = await asRole(db, 'node_worker', (tx) =>
      recordStageFailure(tx, again, 'mac:node', analysis, 'finalize', 'beats_missing', {
        retry: false,
      }),
    )
    expect(final).toBe('failed')
    const [row] = await db.select().from(analyses).where(eq(analyses.id, analysisId))
    expect(row?.status).toBe('failed')
    expect((await eventsOf()).slice(-2)).toMatchObject([
      { type: 'stage.failed', stage: 'finalize', error_code: 'beats_missing' },
      { type: 'analysis.done', status: 'failed' },
    ])
  })

  it('upserts the worker heartbeat row', async () => {
    const worker = { workerId: 'node-test', runner: 'node' as const, hostname: 'mac', version: '1' }
    await asRole(db, 'node_worker', (tx) => queue.writeWorkerHeartbeat(tx, worker, { first: true }))
    await asRole(db, 'node_worker', (tx) =>
      queue.writeWorkerHeartbeat(tx, { ...worker, version: '2' }, { first: false }),
    )
    const rows = await db
      .select()
      .from(workerHeartbeats)
      .where(eq(workerHeartbeats.workerId, 'node-test'))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ runner: 'node', version: '2' })
  })
})

describe('job_events ids', () => {
  const insert = (
    client: { query: (text: string, values: unknown[]) => Promise<unknown> },
    id: string,
    userId = alice,
  ) =>
    client.query(
      `insert into job_events (analysis_id, user_id, event)
       values ($1, $2, '{"type":"progress","value":0.5}') returning id`,
      [id, userId],
    ) as Promise<{ rows: { id: string }[] }>

  // SSE streams page through an analysis' events by id: an event committed after a higher id was
  // already visible would be skipped (migration 0007).
  it('follow commit order within an analysis, and only block that analysis', async () => {
    const bob = await createUser(db)
    const other = (await seedUserGraph(db, bob)).analysis.id
    const first = await db.$client.connect()
    const second = await db.$client.connect()
    try {
      await first.query('begin')
      const early = await insert(first, analysisId)
      await second.query('begin')
      const late = insert(second, analysisId)
      const elsewhere = await insert(db.$client, other, bob)
      expect(Number(elsewhere.rows[0]?.id)).toBeGreaterThan(Number(early.rows[0]?.id))
      const state = await Promise.race([
        late.then(() => 'inserted'),
        new Promise((resolve) => setTimeout(() => resolve('waiting'), 300)),
      ])
      expect(state).toBe('waiting')
      await first.query('commit')
      const lateId = Number((await late).rows[0]?.id)
      await second.query('commit')
      expect(lateId).toBeGreaterThan(Number(elsewhere.rows[0]?.id))
    } finally {
      first.release()
      second.release()
    }
  })
})
