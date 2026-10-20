import { sql } from 'drizzle-orm'
import { bigint, boolean, index, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamptz } from './columns.ts'
import { users } from './users.ts'

// Personal-mode stand-in for PostHog (16-observability-analytics-experiments.md). Events never
// carry audio, titles, file names or emails.
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    props: jsonb('props').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    at: timestamptz('at').notNull().defaultNow(),
  },
  (t) => [
    index('analytics_events_name_at_idx').on(t.name, t.at),
    index('analytics_events_user_at_idx').on(t.userId, t.at),
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
