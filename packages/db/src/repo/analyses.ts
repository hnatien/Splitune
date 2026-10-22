import type { JobEvent } from '@splitune/contracts'
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { type Database, type Transaction, withUser } from '../client.ts'
import { enqueue } from '../jobs/queue.ts'
import { WORKER_ONLINE_WITHIN_S } from '../jobs/stages.ts'
import {
  analyses,
  artefacts,
  type JobRunner,
  jobEvents,
  jobs,
  songs,
  stageRuns,
  type UsageKind,
  uploads,
  usageLedger,
} from '../schema/index.ts'
import type { NewSong, Song } from './songs.ts'

export type Analysis = typeof analyses.$inferSelect
export type NewAnalysis = Omit<
  typeof analyses.$inferInsert,
  'id' | 'userId' | 'createdAt' | 'finishedAt' | 'progress'
>
// What a caller decides about a new run; the repository assigns id, version and status.
export type AnalysisRequest = Omit<NewAnalysis, 'songId' | 'version' | 'status'>

type Event = z.infer<typeof JobEvent>
type Artefact = typeof artefacts.$inferSelect

// One job of an analysis' stage graph. Edges name other jobs of the same plan by `name`.
export interface PlannedJob {
  name: string
  kind: string
  runner: JobRunner
  payload: Record<string, unknown>
  dependsOn?: string[]
  softDependsOn?: string[]
  priority?: number
}

export interface AnalysisPlan {
  jobs: PlannedJob[]
  // Written as the analysis' first events, e.g. stage.completed of the stages it reuses.
  events?: Event[]
  // The song's status while the run is in progress (default `analysing`; a URL import stays
  // `importing` until url_import has downloaded the audio).
  songStatus?: 'importing' | 'analysing'
}

export interface JobState {
  id: number
  kind: string
  status: (typeof jobs.$inferSelect)['status']
  errorCode: string | null
  payload: Record<string, unknown>
}

// Where an analysis reads its audio from: a completed upload, or a finished URL download.
export type SongSource =
  | { kind: 'upload'; id: string; rawKey: string }
  | { kind: 'url'; id: string; rawKey: string; videoKey?: string }
  | { kind: 'url_pending' }

// decode + beats of an earlier analysis that a new one can reuse (and the analysis owning them).
export interface ReusableStages {
  analysisId: string
  probe: Artefact
  beats: Artefact
}

const REUSABLE_STATUSES = ['done', 'fallback'] as const

// The allowance a new run uses (23 §2), reserved in usage_ledger in the run's own transaction.
export interface UsageCharge {
  kind: UsageKind
  // usage_ledger.period_start of the reservation.
  periodStart: string
  // The allowance: units of `counts` already used (in `periodStart`, or ever when `lifetime`)
  // plus this run may not exceed `cap`; null = no cap.
  counts: readonly UsageKind[]
  lifetime?: boolean
  cap: number | null
}

// The run would exceed its allowance; nothing was created.
export class AllowanceExhaustedError extends Error {
  readonly charge: UsageCharge
  constructor(charge: UsageCharge) {
    super(`allowance exhausted: ${charge.kind}`)
    this.charge = charge
    this.name = 'AllowanceExhaustedError'
  }
}

// Counts and reserves under a per-user transaction lock, so concurrent requests never exceed the
// cap (the count of one waits for the other's reservation to commit or roll back).
async function reserve(tx: Transaction, userId: string, analysisId: string, charge: UsageCharge) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`usage:${userId}`}, 0))`)
  if (charge.cap !== null) {
    const [row] = await tx
      .select({ used: sql<number>`coalesce(sum(${usageLedger.units}), 0)::int` })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.userId, userId),
          inArray(usageLedger.kind, [...charge.counts]),
          charge.lifetime ? undefined : eq(usageLedger.periodStart, charge.periodStart),
        ),
      )
    if ((row?.used ?? 0) + 1 > charge.cap) throw new AllowanceExhaustedError(charge)
  }
  await tx
    .insert(usageLedger)
    .values({ userId, periodStart: charge.periodStart, kind: charge.kind, analysisId })
}

async function insertRun(
  tx: Transaction,
  userId: string,
  song: Pick<Song, 'id'>,
  input: AnalysisRequest,
  plan: (analysis: Analysis) => AnalysisPlan,
  charge: UsageCharge | undefined,
): Promise<{ analysis: Analysis; created: boolean; song?: Song }> {
  const [existing] = await tx
    .select()
    .from(analyses)
    .where(and(eq(analyses.userId, userId), eq(analyses.idempotencyKey, input.idempotencyKey)))
  if (existing) return { analysis: existing, created: false }
  const [{ next } = { next: 1 }] = await tx
    .select({ next: sql<number>`coalesce(max(${analyses.version}), 0)::int + 1` })
    .from(analyses)
    .where(and(eq(analyses.userId, userId), eq(analyses.songId, song.id)))
  const [analysis] = await tx
    .insert(analyses)
    .values({ ...input, userId, songId: song.id, version: next, status: 'queued' })
    .returning()
  const created = analysis as Analysis
  if (charge !== undefined) await reserve(tx, userId, created.id, charge)
  const { jobs: planned, events = [], songStatus = 'analysing' } = plan(created)
  const ids = new Map<string, number>()
  const resolve = (names: string[] = []) =>
    names.map((name) => {
      const id = ids.get(name)
      if (id === undefined) throw new Error(`analysis plan: ${name} is not planned before use`)
      return id
    })
  for (const job of planned) {
    const row = await enqueue(tx, job.kind, job.runner, job.payload, {
      analysisId: created.id,
      dependsOn: resolve(job.dependsOn),
      softDependsOn: resolve(job.softDependsOn),
      ...(job.priority === undefined ? {} : { priority: job.priority }),
    })
    ids.set(job.name, row.id)
  }
  for (const event of events) {
    await tx.insert(jobEvents).values({ analysisId: created.id, userId, event })
  }
  const [updated] = await tx
    .update(songs)
    .set({ status: songStatus })
    .where(and(eq(songs.userId, userId), eq(songs.id, song.id)))
    .returning()
  await noteWaitingInTx(tx, userId, created.id)
  return { analysis: created, created: true, ...(updated ? { song: updated } : {}) }
}

// Runnable queued jobs (due, dependencies satisfied) whose runner has no fresh worker heartbeat
// get one `analysis.waiting` event per stall: none is added while the newest event already says so.
async function noteWaitingInTx(
  tx: Transaction,
  userId: string,
  analysisId: string,
): Promise<JobRunner | undefined> {
  const result = await tx.execute(sql`
    select j.runner from jobs j
    where j.analysis_id = ${analysisId} and j.status = 'queued' and j.run_after <= now()
      and not exists (
        select 1 from jobs d where d.id = any(j.depends_on) and d.status <> 'done'
      )
      and not exists (
        select 1 from jobs d
        where d.id = any(j.soft_depends_on) and d.status in ('queued', 'running')
      )
      and not exists (
        select 1 from worker_heartbeats w
        where w.runner = j.runner
          and w.heartbeat_at > now() - make_interval(secs => ${WORKER_ONLINE_WITHIN_S})
      )
    order by j.id
    limit 1
  `)
  const [row] = result.rows as { runner: JobRunner }[]
  if (!row) return undefined
  const [latest] = await tx
    .select({ event: jobEvents.event })
    .from(jobEvents)
    .where(and(eq(jobEvents.userId, userId), eq(jobEvents.analysisId, analysisId)))
    .orderBy(desc(jobEvents.id))
    .limit(1)
  if (latest?.event.type === 'analysis.waiting' && latest.event.runner === row.runner) {
    return undefined
  }
  const at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  await tx.insert(jobEvents).values({
    analysisId,
    userId,
    event: {
      type: 'analysis.waiting',
      reason: 'queued_waiting_for_worker',
      runner: row.runner,
      at,
    },
  })
  return row.runner
}

export function analysesRepo(db: Database) {
  return {
    // Idempotent on (user_id, idempotency_key): a repeated request returns the existing run
    // unchanged. A new run gets the song's next version, its stage graph enqueued in the same
    // transaction (`plan` builds the jobs from the inserted row), the song marked `analysing`
    // and, if no worker is online for its first stage, an `analysis.waiting` event. A `charge`
    // reserves the run's allowance (AllowanceExhaustedError rolls everything back); a repeated
    // request is not charged again. Undefined if the song is not the user's.
    create: (
      userId: string,
      songId: string,
      input: AnalysisRequest,
      plan: (analysis: Analysis) => AnalysisPlan,
      charge?: UsageCharge,
    ) =>
      withUser(db, userId, async (tx) => {
        const [song] = await tx
          .select({ id: songs.id })
          .from(songs)
          .where(and(eq(songs.userId, userId), eq(songs.id, songId)))
          .for('update')
        if (!song) return undefined
        return insertRun(tx, userId, song, input, plan, charge)
      }),

    // URL import: the song and its first analysis (url_import + the stage graph) commit together.
    createWithSong: (
      userId: string,
      newSong: NewSong,
      input: AnalysisRequest,
      plan: (analysis: Analysis) => AnalysisPlan,
      charge?: UsageCharge,
    ) =>
      withUser(db, userId, async (tx) => {
        const [song] = await tx
          .insert(songs)
          .values({ ...newSong, userId })
          .returning()
        const run = await insertRun(tx, userId, song as Song, input, plan, charge)
        return { ...run, song: run.song ?? (song as Song) }
      }),

    get: (userId: string, analysisId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select()
          .from(analyses)
          .where(and(eq(analyses.userId, userId), eq(analyses.id, analysisId)))
        return row
      }),

    listForSong: (userId: string, songId: string) =>
      withUser(db, userId, (tx) =>
        tx
          .select()
          .from(analyses)
          .where(and(eq(analyses.userId, userId), eq(analyses.songId, songId)))
          .orderBy(desc(analyses.createdAt)),
      ),

    // Status of every stage: its stage run, else its job (queued, cancelled, ...). Stages reused
    // from the base analysis come with that analysis' runs and artefacts.
    detail: (userId: string, analysisId: string) =>
      withUser(db, userId, async (tx) => {
        const [analysis] = await tx
          .select()
          .from(analyses)
          .where(and(eq(analyses.userId, userId), eq(analyses.id, analysisId)))
        if (!analysis) return undefined
        const runsOf = (id: string) =>
          tx.select().from(stageRuns).where(eq(stageRuns.analysisId, id))
        const artefactsOf = (id: string) =>
          tx
            .select()
            .from(artefacts)
            .where(and(eq(artefacts.userId, userId), eq(artefacts.analysisId, id)))
            .orderBy(asc(artefacts.kind), asc(artefacts.version))
        const jobRows = await tx
          .select({
            id: jobs.id,
            kind: jobs.kind,
            status: jobs.status,
            errorCode: jobs.errorCode,
            payload: jobs.payload,
          })
          .from(jobs)
          .where(eq(jobs.analysisId, analysisId))
          .orderBy(asc(jobs.id))
        const base = analysis.baseAnalysisId
        return {
          analysis,
          stages: await runsOf(analysisId),
          jobs: jobRows as JobState[],
          artefacts: await artefactsOf(analysisId),
          base:
            base === null
              ? undefined
              : { stages: await runsOf(base), artefacts: await artefactsOf(base) },
        }
      }),

    // SSE replay: the analysis' events after `afterId`, oldest first. Undefined if the analysis
    // is not the user's (or was deleted with its song).
    events: (userId: string, analysisId: string, afterId: number, limit: number) =>
      withUser(db, userId, async (tx) => {
        const [analysis] = await tx
          .select({ id: analyses.id, status: analyses.status })
          .from(analyses)
          .where(and(eq(analyses.userId, userId), eq(analyses.id, analysisId)))
        if (!analysis) return undefined
        const rows = await tx
          .select({ id: jobEvents.id, event: jobEvents.event })
          .from(jobEvents)
          .where(
            and(
              eq(jobEvents.userId, userId),
              eq(jobEvents.analysisId, analysisId),
              gt(jobEvents.id, afterId),
            ),
          )
          .orderBy(asc(jobEvents.id))
          .limit(limit)
        return { status: analysis.status, rows }
      }),

    noteWaiting: (userId: string, analysisId: string) =>
      withUser(db, userId, (tx) => noteWaitingInTx(tx, userId, analysisId)),

    // The audio a new analysis of this song reads: the latest completed upload, or for a URL song
    // the latest finished download (url_pending: none yet, the analysis must download again).
    // Undefined if the song is not the user's or has no usable source.
    source: (userId: string, songId: string) =>
      withUser(db, userId, async (tx): Promise<{ song: Song; source?: SongSource } | undefined> => {
        const [song] = await tx
          .select()
          .from(songs)
          .where(and(eq(songs.userId, userId), eq(songs.id, songId)))
        if (!song) return undefined
        if (song.sourceKind === 'url') {
          const [download] = await tx
            .select({ payload: jobs.payload })
            .from(jobs)
            .innerJoin(analyses, eq(analyses.id, jobs.analysisId))
            .where(
              and(
                eq(analyses.userId, userId),
                eq(analyses.songId, songId),
                eq(jobs.kind, 'url_import'),
                eq(jobs.status, 'done'),
              ),
            )
            .orderBy(desc(jobs.id))
            .limit(1)
          // url_import's StageRequest: outputs.source = u/{user}/raw/{import_id}/source.bin, and
          // outputs.video = …/video.mp4 when the video was requested.
          const request = download?.payload as
            | { outputs?: { source?: string; video?: string } }
            | undefined
          const rawKey = request?.outputs?.source
          const videoKey = request?.outputs?.video
          const id = rawKey?.split('/')[3]
          return {
            song,
            source:
              rawKey && id
                ? { kind: 'url', id, rawKey, ...(videoKey ? { videoKey } : {}) }
                : { kind: 'url_pending' as const },
          }
        }
        const [upload] = await tx
          .select({ id: uploads.id, objectKey: uploads.objectKey })
          .from(uploads)
          .where(
            and(
              eq(uploads.userId, userId),
              eq(uploads.songId, songId),
              inArray(uploads.status, ['uploaded', 'validated']),
            ),
          )
          .orderBy(desc(uploads.createdAt))
          .limit(1)
        return upload
          ? { song, source: { kind: 'upload', id: upload.id, rawKey: upload.objectKey } }
          : { song }
      }),

    // decode + beats a new analysis of the song can reuse: those of its latest finished
    // analysis (or of the analysis that one reused them from), when both stages succeeded and
    // their artefacts exist.
    reusableStages: (userId: string, songId: string) =>
      withUser(db, userId, async (tx): Promise<ReusableStages | undefined> => {
        const [latest] = await tx
          .select({ id: analyses.id, baseAnalysisId: analyses.baseAnalysisId })
          .from(analyses)
          .where(
            and(
              eq(analyses.userId, userId),
              eq(analyses.songId, songId),
              inArray(analyses.status, ['done', 'partial']),
            ),
          )
          .orderBy(desc(analyses.createdAt))
          .limit(1)
        if (!latest) return undefined
        const owner = latest.baseAnalysisId ?? latest.id
        const runs = await tx
          .select({ stage: stageRuns.stage })
          .from(stageRuns)
          .where(
            and(
              eq(stageRuns.analysisId, owner),
              inArray(stageRuns.stage, ['decode', 'beats']),
              inArray(stageRuns.status, [...REUSABLE_STATUSES]),
            ),
          )
        if (runs.length !== 2) return undefined
        const rows = await tx
          .select()
          .from(artefacts)
          .where(
            and(
              eq(artefacts.userId, userId),
              eq(artefacts.analysisId, owner),
              inArray(artefacts.kind, ['probe', 'beats']),
            ),
          )
          .orderBy(desc(artefacts.version))
        const probe = rows.find((r) => r.kind === 'probe')
        const beats = rows.find((r) => r.kind === 'beats')
        return probe && beats ? { analysisId: owner, probe, beats } : undefined
      }),
  }
}
