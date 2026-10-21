import type { JobEvent } from '@splitune/contracts'
import { sql } from 'drizzle-orm'
import { bigint, check, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import type { z } from 'zod'
import { analyses } from './analysis.ts'
import { oneOf, timestamptz } from './columns.ts'
import { users } from './users.ts'

export const JOB_RUNNERS = ['python', 'node'] as const
export type JobRunner = (typeof JOB_RUNNERS)[number]

export const JOB_STATUSES = ['queued', 'running', 'done', 'failed', 'cancelled'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

// Postgres job queue of 25-personal-mode.md (replaces Inngest). Protocol: packages/db/README.md.
export const jobs = pgTable(
  'jobs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    // A StageName for pipeline stages, or a maintenance kind such as `sweep`.
    kind: text('kind').notNull(),
    runner: text('runner', { enum: JOB_RUNNERS }).notNull(),
    analysisId: uuid('analysis_id').references(() => analyses.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: text('status', { enum: JOB_STATUSES }).notNull().default('queued'),
    // Lower runs first; Plus gets priority processing with a lower number.
    priority: integer('priority').notNull().default(100),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    runAfter: timestamptz('run_after').notNull().defaultNow(),
    lockedBy: text('locked_by'),
    lockedAt: timestamptz('locked_at'),
    heartbeatAt: timestamptz('heartbeat_at'),
    dependsOn: bigint('depends_on', { mode: 'number' })
      .array()
      .notNull()
      .default(sql`'{}'::bigint[]`),
    // Jobs that must have finished (done, failed or cancelled) but need not have succeeded: a
    // dependant that has a fallback for a missing input (06 §6). A failure here cancels nothing.
    softDependsOn: bigint('soft_depends_on', { mode: 'number' })
      .array()
      .notNull()
      .default(sql`'{}'::bigint[]`),
    errorCode: text('error_code'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('jobs_claim_idx').on(t.runner, t.status, t.priority, t.runAfter),
    index('jobs_depends_on_idx').using('gin', t.dependsOn),
    index('jobs_analysis_idx').on(t.analysisId),
    check('jobs_runner_check', oneOf(t.runner, JOB_RUNNERS)),
    check('jobs_status_check', oneOf(t.status, JOB_STATUSES)),
    check('jobs_attempts_check', sql`${t.maxAttempts} > 0 and ${t.attempts} >= 0`),
  ],
)

// Feeds the SSE stream of GET /v1/analyses/{id}/events (04-api-contract.md).
export const jobEvents = pgTable(
  'job_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    event: jsonb('event').$type<z.infer<typeof JobEvent>>().notNull(),
    at: timestamptz('at').notNull().defaultNow(),
  },
  (t) => [index('job_events_analysis_idx').on(t.analysisId, t.id)],
)

// Written every 30 s by each Mac worker; `app` shows "processing machine offline" when stale.
export const workerHeartbeats = pgTable(
  'worker_heartbeats',
  {
    workerId: text('worker_id').primaryKey(),
    runner: text('runner', { enum: JOB_RUNNERS }).notNull(),
    hostname: text('hostname'),
    version: text('version'),
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    heartbeatAt: timestamptz('heartbeat_at').notNull().defaultNow(),
  },
  (t) => [check('worker_heartbeats_runner_check', oneOf(t.runner, JOB_RUNNERS))],
)
