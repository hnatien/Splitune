import type { JobEvent, ModelRef, StageName, StageStatus } from '@splitune/contracts'
import { and, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import type { Executor } from '../client.ts'
import {
  analyses,
  artefacts,
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
  // finalize: the analysis' end state, written with an `analysis.done` event.
  analysisDone?: { status: 'done' | 'partial'; summaryKind: string }
}

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

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

export async function markStageStarted(
  db: Executor,
  job: Job,
  analysis: AnalysisRef,
  stage: z.infer<typeof StageName>,
): Promise<void> {
  await db.transaction(async (tx) => {
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
    await addEvent(tx, analysis, { type: 'stage.started', stage, at: now() })
  })
}

class LockLostError extends Error {}

// Records the result and completes the job atomically. false = the lock was lost (rolled back).
export async function finishStage(db: Executor, finish: StageFinish): Promise<boolean> {
  const { analysis, stage } = finish
  try {
    await db.transaction(async (tx) => {
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
        const { status, summaryKind } = finish.analysisDone
        await tx
          .update(analyses)
          .set({ status, progress: 1, finishedAt: sql`now()` })
          .where(eq(analyses.id, analysis.id))
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
        await addEvent(tx, analysis, { type: 'analysis.done', status: 'failed' })
      }
    }
    return status
  })
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
