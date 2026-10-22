import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core'
import { oneOf, timestamptz } from './columns.ts'
import { users } from './users.ts'

// Personal-mode stand-in for PostHog (16-observability-analytics-experiments.md). Events never
// carry audio, titles, file names or emails, and rows are keyed by a salted hash of the user id
// (16 §6; `@splitune/analytics/server`), null for visitors. Account deletion removes them by hash.
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userHash: text('user_hash'),
    name: text('name').notNull(),
    props: jsonb('props').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    at: timestamptz('at').notNull().defaultNow(),
  },
  (t) => [
    index('analytics_events_name_at_idx').on(t.name, t.at),
    index('analytics_events_user_hash_at_idx').on(t.userHash, t.at),
  ],
)

// Remote-configurable flags and plan limits, e.g. `plan.free.lite_per_month` (23-… §6).
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  value: jsonb('value'),
  description: text('description'),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
})

// "Download my data" requests (15 §4): the node worker writes the bundle to `object_key` and the
// lifecycle sweeper deletes it after `expires_at`.
export const DATA_EXPORT_STATUSES = ['pending', 'ready', 'failed', 'expired'] as const

export const dataExports = pgTable(
  'data_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: DATA_EXPORT_STATUSES }).notNull().default('pending'),
    objectKey: text('object_key').notNull(),
    bytes: integer('bytes'),
    errorCode: text('error_code'),
    requestedAt: timestamptz('requested_at').notNull().defaultNow(),
    readyAt: timestamptz('ready_at'),
    expiresAt: timestamptz('expires_at'),
  },
  (t) => [
    index('data_exports_user_requested_idx').on(t.userId, t.requestedAt.desc()),
    check('data_exports_status_check', oneOf(t.status, DATA_EXPORT_STATUSES)),
  ],
)

// The node worker's scheduled lifecycle jobs (15 §3): one row per job, claimed by a compare-and-set
// on last_started_at so a job runs once per due time however many workers tick.
export const scheduleRuns = pgTable('schedule_runs', {
  name: text('name').primaryKey(),
  lastStartedAt: timestamptz('last_started_at'),
  lastFinishedAt: timestamptz('last_finished_at'),
  lastStatus: text('last_status'),
  lastErrorCode: text('last_error_code'),
  lastResult: jsonb('last_result').$type<Record<string, unknown>>(),
})

// Survives user deletion on purpose (legal record); holds identifiers only.
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    subjectUserId: text('subject_user_id'),
    subject: jsonb('subject'),
    at: timestamptz('at').notNull().defaultNow(),
  },
  (t) => [index('audit_log_subject_user_idx').on(t.subjectUserId, t.at)],
)

// Fixed-window request counters for the API's rate limits (17-security.md §5). Keys name the
// policy and the subject, e.g. `uploads:user:<id>` or `auth:ip:<address>`; the table is used by the
// table owner only and swept by maintenance.
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    windowStart: timestamptz('window_start').notNull(),
    count: integer('count').notNull(),
  },
  (t) => [index('rate_limits_window_start_idx').on(t.windowStart)],
)
