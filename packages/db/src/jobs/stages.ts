import type {
  JobEvent,
  ModelRef,
  RecommendedView,
  StageName,
  StageStatus,
} from '@splitune/contracts'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { Executor } from '../client.ts'
import {
  analyses,
  artefacts,
  JOB_RUNNERS,
  type JobRunner,
  jobEvents,
  stageRuns,
  workerHeartbeats,
} from '../schema/index.ts'
import { complete, fail, type Job } from './queue.ts'

// Stage bookkeeping for the Node worker, the same statements the Python executor issues
// (services/ml/.../executor.py): stage_runs, artefacts and job_events, with the job's `complete`
// last in the transaction so a result is recorded exactly once even when the lock was lost.

export interface AnalysisRef {
  id: string
  userId: string
  version: number
}

export interface WrittenArtefact {
  kind: string
  key: string
  sha256: string
  bytes: number
}

export interface StageFinish {
  job: Job
  workerId: string
  analysis: AnalysisRef
  stage: z.infer<typeof StageName>
  status: Extract<z.infer<typeof StageStatus>, 'done' | 'fallback'>
  written: WrittenArtefact[]
  modelRefs: z.infer<typeof ModelRef>[]
  primaryKind: string
  // finalize: the analysis' end state, written with an `analysis.done` event, and the view the
  // summary recommends for the requested instrument.
  analysisDone?: {
    status: 'done' | 'partial'
    summaryKind: string
    recommendedView?: z.infer<typeof RecommendedView>
  }
}

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

// Song status that mirrors how its latest analysis ended (an older analysis finishing late
// leaves the song alone).
const SONG_STATUS = { done: 'ready', partial: 'partial', failed: 'failed' } as const

async function setSongStatus(db: Executor, analysisId: string, status: keyof typeof SONG_STATUS) {
  await db.execute(sql`
    update songs s set status = ${SONG_STATUS[status]}
    from analyses a
    where a.id = ${analysisId} and s.id = a.song_id
      and not exists (
        select 1 from analyses n where n.song_id = a.song_id and n.created_at > a.created_at
      )
  `)
}

// First statement of every transaction that writes the analysis' events. The job_events trigger
// (migration 0007) takes this row lock anyway; an insert that references the analysis before it
// (stage_runs, artefacts) holds the foreign key's share lock, so two such transactions would each
// wait for the other's share lock to upgrade to the row lock: a deadlock.
async function lockAnalysis(db: Executor, analysisId: string) {
  await db
    .select({ id: analyses.id })
    .from(analyses)
    .where(eq(analyses.id, analysisId))
    .for('update')
}

async function addEvent(db: Executor, analysis: AnalysisRef, event: z.infer<typeof JobEvent>) {
  await db.insert(jobEvents).values({ analysisId: analysis.id, userId: analysis.userId, event })
}

export async function loadAnalysis(
  db: Executor,
  analysisId: string,
): Promise<AnalysisRef | undefined> {
  const [row] = await db
    .select({ id: analyses.id, userId: analyses.userId, version: analyses.version })
    .from(analyses)
    .where(eq(analyses.id, analysisId))
  return row
}

// Inputs count only when an artefact row records their object, i.e. the stage that writes them
// succeeded (a failed or cancelled stage leaves its key unrecorded, even if an earlier attempt
// left an object behind). Same rule as the Python executor's optional inputs.
export async function recordedKeys(db: Executor, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set()
  const rows = await db
    .select({ key: artefacts.objectKey })
    .from(artefacts)
    .where(inArray(artefacts.objectKey, keys))
  return new Set(rows.map((r) => r.key))
}

export async function markStageStarted(
  db: Executor,
  job: Job,
  analysis: AnalysisRef,
  stage: z.infer<typeof StageName>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockAnalysis(tx, analysis.id)
    await tx
      .insert(stageRuns)
      .values({
        analysisId: analysis.id,
        stage,
        status: 'running',
        modelRefs: [],
        cacheKey: '',
        attempts: job.attempts,
        startedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [stageRuns.analysisId, stageRuns.stage],
        set: {
          status: 'running',
          attempts: job.attempts,
          errorCode: null,
          startedAt: sql`now()`,
          finishedAt: null,
        },
      })
    await tx
      .update(analyses)
      .set({ status: 'running' })
      .where(and(eq(analyses.id, analysis.id), eq(analyses.status, 'queued')))
    await addEvent(tx, analysis, { type: 'stage.started', stage, at: now() })
  })
}

class LockLostError extends Error {}

// Records the result and completes the job atomically. false = the lock was lost (rolled back).
export async function finishStage(db: Executor, finish: StageFinish): Promise<boolean> {
  const { analysis, stage } = finish
  try {
    await db.transaction(async (tx) => {
      await lockAnalysis(tx, analysis.id)
      const ids = new Map<string, string>()
      for (const w of finish.written) {
        const [row] = await tx
          .insert(artefacts)
          .values({
            userId: analysis.userId,
            analysisId: analysis.id,
            kind: w.kind,
            version: analysis.version,
            objectKey: w.key,
            bytes: w.bytes,
            sha256: w.sha256,
            modelRefs: finish.modelRefs,
          })
          .onConflictDoUpdate({
            target: [artefacts.analysisId, artefacts.kind, artefacts.version],
            set: {
              objectKey: w.key,
              bytes: w.bytes,
              sha256: w.sha256,
              modelRefs: finish.modelRefs,
            },
          })
          .returning({ id: artefacts.id })
        if (row) ids.set(w.kind, row.id)
      }
      await tx
        .update(stageRuns)
        .set({
          status: finish.status,
          modelRefs: finish.modelRefs,
          errorCode: null,
          finishedAt: sql`now()`,
        })
        .where(and(eq(stageRuns.analysisId, analysis.id), eq(stageRuns.stage, stage)))
      const primary = ids.get(finish.primaryKind)
      await addEvent(tx, analysis, {
        type: 'stage.completed',
        stage,
        ...(primary === undefined
          ? {}
          : { artefact: { id: primary, kind: finish.primaryKind, version: analysis.version } }),
        at: now(),
      })
      if (finish.analysisDone !== undefined) {
        const { status, summaryKind, recommendedView } = finish.analysisDone
        await tx
          .update(analyses)
          .set({
            status,
            progress: 1,
            finishedAt: sql`now()`,
            ...(recommendedView === undefined ? {} : { recommendedView }),
          })
          .where(eq(analyses.id, analysis.id))
        await setSongStatus(tx, analysis.id, status)
        const summaryId = ids.get(summaryKind)
        await addEvent(tx, analysis, {
          type: 'analysis.done',
          status,
          ...(summaryId === undefined ? {} : { summary_artefact_id: summaryId }),
        })
      }
      if (!(await complete(tx, finish.job.id, finish.workerId))) throw new LockLostError()
    })
  } catch (error) {
    if (error instanceof LockLostError) return false
    throw error
  }
  return true
}

// `fail` plus stage_runs and (on a permanent failure) `stage.failed` in one transaction. A
// permanently failed finalize also fails the analysis. Returns the new job status, or undefined
// when the lock was lost.
export async function recordStageFailure(
  db: Executor,
  job: Job,
  workerId: string,
  analysis: AnalysisRef | undefined,
  stage: z.infer<typeof StageName> | undefined,
  errorCode: string,
  { retry }: { retry: boolean },
): Promise<'queued' | 'failed' | undefined> {
  return db.transaction(async (tx) => {
    if (analysis !== undefined) await lockAnalysis(tx, analysis.id)
    const status = await fail(tx, job.id, workerId, errorCode, { retry })
    if (status === undefined || analysis === undefined || stage === undefined) return status
    await tx
      .update(stageRuns)
      .set({
        status: status === 'failed' ? 'failed' : 'pending',
        errorCode,
        finishedAt: status === 'failed' ? sql`now()` : null,
      })
      .where(and(eq(stageRuns.analysisId, analysis.id), eq(stageRuns.stage, stage)))
    if (status === 'failed') {
      await addEvent(tx, analysis, {
        type: 'stage.failed',
        stage,
        error_code: errorCode,
        at: now(),
      })
      if (stage === 'finalize') {
        await tx
          .update(analyses)
          .set({ status: 'failed', finishedAt: sql`now()` })
          .where(eq(analyses.id, analysis.id))
        await setSongStatus(tx, analysis.id, 'failed')
        await addEvent(tx, analysis, { type: 'analysis.done', status: 'failed' })
      }
    }
    return status
  })
}

// finalize found nothing to build on (a critical stage such as decode or beats failed, and the
// queue cancelled what depended on it): the stage is `skipped`, the analysis and its song end
// `failed` with an `analysis.done` event, and the job completes. false = the lock was lost.
export async function finishAnalysisFailed(
  db: Executor,
  job: Job,
  workerId: string,
  analysis: AnalysisRef,
  stage: z.infer<typeof StageName>,
): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      await lockAnalysis(tx, analysis.id)
      await tx
        .update(stageRuns)
        .set({ status: 'skipped', finishedAt: sql`now()` })
        .where(and(eq(stageRuns.analysisId, analysis.id), eq(stageRuns.stage, stage)))
      await tx
        .update(analyses)
        .set({ status: 'failed', finishedAt: sql`now()` })
        .where(eq(analyses.id, analysis.id))
      await setSongStatus(tx, analysis.id, 'failed')
      await addEvent(tx, analysis, { type: 'analysis.done', status: 'failed' })
      if (!(await complete(tx, job.id, workerId))) throw new LockLostError()
    })
  } catch (error) {
    if (error instanceof LockLostError) return false
    throw error
  }
  return true
}

// A runner counts as online while one of its workers heartbeated within this window (25 §5: the
// app shows "processing machine offline" when the heartbeat is older than 2 minutes).
export const WORKER_ONLINE_WITHIN_S = 120

export interface RunnerPresence {
  online: boolean
  lastHeartbeatAt: Date | null
}

// Latest heartbeat per runner, judged on the database clock.
export async function workerPresence(db: Executor): Promise<Record<JobRunner, RunnerPresence>> {
  const result = await db.execute(sql`
    select runner, max(heartbeat_at) as last,
           bool_or(heartbeat_at > now() - make_interval(secs => ${WORKER_ONLINE_WITHIN_S})) as online
    from worker_heartbeats group by runner
  `)
  const rows = result.rows as { runner: JobRunner; last: string | Date; online: boolean }[]
  return Object.fromEntries(
    JOB_RUNNERS.map((runner) => {
      const row = rows.find((r) => r.runner === runner)
      return [
        runner,
        { online: row?.online ?? false, lastHeartbeatAt: row ? new Date(row.last) : null },
      ]
    }),
  ) as Record<JobRunner, RunnerPresence>
}

export interface StageTiming {
  stage: z.infer<typeof StageName>
  medianS: number
  runs: number
}

// Recent wall-clock time per stage (13 §4: the progress UI's ETA): the median over each stage's
// latest 50 successful runs of the last 30 days, every user's runs (aggregates only). Cache hits
// count too: they are what a re-analysis of known audio takes.
export const TIMING_RUNS = 50
export const TIMING_WINDOW_DAYS = 30

export async function stageTimings(db: Executor): Promise<StageTiming[]> {
  const result = await db.execute(sql`
    select stage,
           percentile_cont(0.5) within group (
             order by extract(epoch from finished_at - started_at)
           ) as median_s,
           count(*)::int as runs
    from (
      select stage, started_at, finished_at,
             row_number() over (partition by stage order by finished_at desc) as n
      from stage_runs
      where status in ('done', 'fallback') and started_at is not null and finished_at is not null
        and finished_at >= started_at
        and finished_at > now() - make_interval(days => ${TIMING_WINDOW_DAYS})
    ) recent
    where n <= ${TIMING_RUNS}
    group by stage
    order by stage
  `)
  const rows = result.rows as { stage: StageTiming['stage']; median_s: number; runs: number }[]
  return rows.map((r) => ({ stage: r.stage, medianS: Number(r.median_s), runs: r.runs }))
}

// Worker presence (25 §5): `app` shows "processing machine offline" when this row is stale.
export async function writeWorkerHeartbeat(
  db: Executor,
  worker: { workerId: string; runner: JobRunner; hostname: string; version: string },
  { first }: { first: boolean },
): Promise<void> {
  await db
    .insert(workerHeartbeats)
    .values({ ...worker, startedAt: sql`now()`, heartbeatAt: sql`now()` })
    .onConflictDoUpdate({
      target: workerHeartbeats.workerId,
      set: {
        hostname: worker.hostname,
        version: worker.version,
        heartbeatAt: sql`now()`,
        ...(first ? { startedAt: sql`now()` } : {}),
      },
    })
}
