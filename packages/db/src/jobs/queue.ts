import { getTableColumns, inArray, sql } from 'drizzle-orm'
import type { Executor } from '../client.ts'
import { type JobRunner, jobs } from '../schema/index.ts'

// Postgres job queue (25-personal-mode.md). The SQL here is the protocol the Python consumer
// implements too (step 06); packages/db/README.md documents it statement by statement.

export type Job = typeof jobs.$inferSelect

export interface EnqueueOptions {
  analysisId?: string
  dependsOn?: number[]
  // Must have finished, successfully or not, before this job runs (no cancellation cascade).
  softDependsOn?: number[]
  priority?: number
  maxAttempts?: number
  runAfter?: Date
}

export interface ClaimOptions {
  // Restrict to these kinds, e.g. so a worker can keep one MPS slot and two CPU slots.
  kinds?: string[]
}

export interface FailOptions {
  // false = permanent failure (bad input); true = retry with backoff while attempts remain.
  retry?: boolean
}

export interface RequeueOptions {
  staleAfterSeconds?: number
}

// Retry delay after attempt n: min(BACKOFF_BASE_S * 2^(n-1), BACKOFF_MAX_S).
export const BACKOFF_BASE_S = 15
export const BACKOFF_MAX_S = 900
// A running job whose heartbeat is older than this is treated as abandoned (25 §5: 2 min).
export const STALE_AFTER_S = 120

export const channelFor = (runner: JobRunner) => `jobs_${runner}`

// Raw `execute()` rows bypass Drizzle's result mapping, so decode them with the columns' own
// mappers (bigint strings to numbers, timestamp strings to Dates, bigint[] literals to arrays).
const JOB_COLUMNS = Object.entries(getTableColumns(jobs))
type IdRow = { id: string }

function toJob(row: Record<string, unknown>): Job {
  return Object.fromEntries(
    JOB_COLUMNS.map(([key, column]) => {
      const value = row[column.name]
      return [key, value === null ? null : column.mapFromDriverValue(value)]
    }),
  ) as Job
}

const bigintArray = (ids: number[]) => sql`${`{${ids.join(',')}}`}::bigint[]`

// Inserts a queued job and wakes idle workers with NOTIFY jobs_<runner> (delivered on commit).
export async function enqueue(
  db: Executor,
  kind: string,
  runner: JobRunner,
  payload: Record<string, unknown>,
  {
    analysisId,
    dependsOn = [],
    softDependsOn = [],
    priority,
    maxAttempts,
    runAfter,
  }: EnqueueOptions = {},
): Promise<Job> {
  return db.transaction(async (tx) => {
    const deps = [...new Set([...dependsOn, ...softDependsOn])]
    if (deps.length > 0) {
      const found = await tx.select({ id: jobs.id }).from(jobs).where(inArray(jobs.id, deps))
      if (found.length !== deps.length) {
        throw new Error(`enqueue ${kind}: unknown dependency in [${deps.join(', ')}]`)
      }
    }
    const [job] = await tx
      .insert(jobs)
      .values({
        kind,
        runner,
        payload,
        dependsOn,
        softDependsOn,
        ...(analysisId === undefined ? {} : { analysisId }),
        ...(priority === undefined ? {} : { priority }),
        ...(maxAttempts === undefined ? {} : { maxAttempts }),
        ...(runAfter === undefined ? {} : { runAfter }),
      })
      .returning()
    const created = job as Job
    await tx.execute(sql`select pg_notify(${channelFor(runner)}, ${String(created.id)})`)
    return created
  })
}

// Locks the next runnable job for `runner`: queued, due, every dependency done, every soft
// dependency finished (done, failed or cancelled); lowest priority number first, then oldest. SKIP LOCKED lets concurrent claimers pass over each other's rows, so
// each job is handed to exactly one worker. Returns undefined when nothing is runnable.
export async function claim(
  db: Executor,
  runner: JobRunner,
  workerId: string,
  { kinds }: ClaimOptions = {},
): Promise<Job | undefined> {
  const kindFilter =
    kinds === undefined
      ? sql`true`
      : kinds.length === 0
        ? sql`false`
        : sql`j.kind in (${sql.join(
            kinds.map((k) => sql`${k}`),
            sql`, `,
          )})`
  const result = await db.execute(sql`
    with next as (
      select j.id
      from jobs j
      where j.runner = ${runner}
        and j.status = 'queued'
        and j.run_after <= now()
        and ${kindFilter}
        and not exists (
          select 1 from jobs d where d.id = any(j.depends_on) and d.status <> 'done'
        )
        and not exists (
          select 1 from jobs d
          where d.id = any(j.soft_depends_on) and d.status in ('queued', 'running')
        )
      order by j.priority, j.id
      limit 1
      for update of j skip locked
    )
    update jobs
    set status = 'running',
        attempts = jobs.attempts + 1,
        locked_by = ${workerId},
        locked_at = now(),
        heartbeat_at = now(),
        error_code = null
    from next
    where jobs.id = next.id
    returning jobs.*
  `)
  const [row] = result.rows
  return row ? toJob(row) : undefined
}

// Extends the lock. false = the lock was lost (requeued as stale or cancelled): stop working.
export async function heartbeat(db: Executor, jobId: number, workerId: string): Promise<boolean> {
  const result = await db.execute(sql`
    update jobs set heartbeat_at = now()
    where id = ${jobId} and locked_by = ${workerId} and status = 'running'
  `)
  return result.rowCount === 1
}

// false = the lock was lost; the result must be discarded.
export async function complete(db: Executor, jobId: number, workerId: string): Promise<boolean> {
  const result = await db.execute(sql`
    update jobs set status = 'done', heartbeat_at = now()
    where id = ${jobId} and locked_by = ${workerId} and status = 'running'
  `)
  return result.rowCount === 1
}

// Cancels every queued job that (transitively) waits on one of `failedIds`, since its
// dependencies can no longer finish. Soft dependencies don't count: those jobs run regardless.
async function cancelDependents(db: Executor, failedIds: number[]): Promise<number[]> {
  if (failedIds.length === 0) return []
  const result = await db.execute(sql`
    with recursive dependents as (
      select j.id from jobs j
      where j.depends_on && ${bigintArray(failedIds)} and j.status = 'queued'
      union
      select j.id from jobs j join dependents d on j.depends_on @> array[d.id]
      where j.status = 'queued'
    )
    update jobs set status = 'cancelled', error_code = 'dependency_failed'
    where id in (select id from dependents)
    returning id
  `)
  return (result.rows as IdRow[]).map((r) => Number(r.id))
}

// Records a failed attempt. Retries with exponential backoff while attempts remain (and `retry`
// is true); otherwise marks the job failed and cancels its dependents. Returns the new status, or
// undefined if the lock was lost.
export async function fail(
  db: Executor,
  jobId: number,
  workerId: string,
  errorCode: string,
  { retry = true }: FailOptions = {},
): Promise<'queued' | 'failed' | undefined> {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      update jobs
      set status = case when ${retry}::boolean and attempts < max_attempts then 'queued' else 'failed' end,
          run_after = case when ${retry}::boolean and attempts < max_attempts
            then now() + make_interval(secs => least(${BACKOFF_BASE_S}::float8 * power(2, attempts - 1), ${BACKOFF_MAX_S}::float8))
            else run_after end,
          locked_by = null,
          locked_at = null,
          heartbeat_at = null,
          error_code = ${errorCode}
      where id = ${jobId} and locked_by = ${workerId} and status = 'running'
      returning status
    `)
    const [row] = result.rows as { status: 'queued' | 'failed' }[]
    if (!row) return undefined
    const { status } = row
    if (status === 'failed') await cancelDependents(tx, [jobId])
    return status
  })
}

// Sweeps running jobs whose worker stopped heartbeating (crash, sleep, network loss). Each one is
// re-queued if attempts remain, else failed (and its dependents cancelled), with error_code
// `lock_expired`. Safe to run from several places: rows are locked with SKIP LOCKED.
export async function requeueStale(
  db: Executor,
  { staleAfterSeconds = STALE_AFTER_S }: RequeueOptions = {},
): Promise<{ requeued: number[]; failed: number[] }> {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      with stale as (
        select id from jobs
        where status = 'running'
          and heartbeat_at < now() - make_interval(secs => ${staleAfterSeconds}::float8)
        for update skip locked
      )
      update jobs
      set status = case when attempts < max_attempts then 'queued' else 'failed' end,
          run_after = now(),
          locked_by = null,
          locked_at = null,
          heartbeat_at = null,
          error_code = 'lock_expired'
      from stale
      where jobs.id = stale.id
      returning jobs.id, jobs.status
    `)
    const rows = result.rows as (IdRow & { status: 'queued' | 'failed' })[]
    const requeued = rows.filter((r) => r.status === 'queued').map((r) => Number(r.id))
    const failed = rows.filter((r) => r.status === 'failed').map((r) => Number(r.id))
    await cancelDependents(tx, failed)
    return { requeued, failed }
  })
}
