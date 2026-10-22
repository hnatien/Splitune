import { inSpan } from '@splitune/analytics/tracing'
import { type Database, queue } from '@splitune/db'
import type { TimeOfDay } from './config.ts'
import { errorName } from './execute.ts'
import type { Logger } from './log.ts'

// Cron-like scheduler for the lifecycle jobs (15 §3) inside the node worker. Each job has a due
// time — every hour on the hour, or once a day at a local time — and runs at most once per due
// time: the claim is a compare-and-set in schedule_runs, so two workers (or a restart) never run it
// twice, and a Mac that was asleep at 03:30 runs the night's jobs when it wakes.

export type Cadence = { every: 'hour' } | { every: 'day'; at: TimeOfDay }

export interface ScheduledJob {
  name: string
  cadence: Cadence
  // Returns what to remember about the run (digest material); throws on failure.
  run(): Promise<Record<string, unknown>>
}

const HOUR_MS = 3_600_000

// The latest due time at or before `now` (local time for daily jobs).
export function lastDueAt(cadence: Cadence, now: Date): Date {
  if (cadence.every === 'hour') return new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS)
  const due = new Date(now)
  due.setHours(cadence.at.hour, cadence.at.minute, 0, 0)
  if (due > now) due.setDate(due.getDate() - 1)
  return due
}

export class Scheduler {
  private timer: NodeJS.Timeout | undefined
  private running: Promise<void> | undefined
  private readonly db: Database
  private readonly jobs: ScheduledJob[]
  private readonly log: Logger
  private readonly tickMs: number

  constructor(db: Database, jobs: ScheduledJob[], log: Logger, tickMs = 60_000) {
    this.db = db
    this.jobs = jobs
    this.log = log
    this.tickMs = tickMs
  }

  start(): void {
    const tick = () => {
      this.running ??= this.runDue(new Date()).then(
        () => {
          this.running = undefined
        },
        () => {
          this.running = undefined
        },
      )
    }
    tick()
    this.timer = setInterval(tick, this.tickMs)
  }

  async stop(): Promise<void> {
    clearInterval(this.timer)
    await this.running
  }

  // Runs every job whose due time has come and that nobody ran for it yet, one after another.
  async runDue(now: Date): Promise<string[]> {
    const ran: string[] = []
    for (const job of this.jobs) {
      try {
        const due = lastDueAt(job.cadence, now)
        if (!(await queue.lifecycle.claimScheduledRun(this.db, job.name, due))) continue
      } catch (error) {
        this.log.warn('schedule claim failed', { job: job.name, error_code: errorName(error) })
        continue
      }
      ran.push(job.name)
      const started = Date.now()
      try {
        const result = await inSpan(`lifecycle ${job.name}`, { 'lifecycle.job': job.name }, () =>
          job.run(),
        )
        await queue.lifecycle.finishScheduledRun(this.db, job.name, { status: 'done', result })
        this.log.info('scheduled job done', {
          job: job.name,
          wall_s: (Date.now() - started) / 1000,
          ...result,
        })
      } catch (error) {
        const errorCode = error instanceof LifecycleError ? error.code : 'internal_error'
        this.log.error('scheduled job failed', {
          job: job.name,
          error_code: errorCode,
          error_name: errorName(error),
        })
        await queue.lifecycle
          .finishScheduledRun(this.db, job.name, { status: 'failed', errorCode })
          .catch((cause: unknown) =>
            this.log.warn('schedule finish failed', {
              job: job.name,
              error_code: errorName(cause),
            }),
          )
      }
    }
    return ran
  }
}

// A lifecycle failure with a machine code (06 §3): what the digest and the logs show.
export class LifecycleError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = code
  }
}
