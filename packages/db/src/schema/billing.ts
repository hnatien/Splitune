import { Plan, Subscription } from '@splitune/contracts'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core'
import { analyses } from './analysis.ts'
import { oneOf, timestamptz, values } from './columns.ts'
import { users } from './users.ts'

const SubscriptionStatus = Subscription.shape.status

// Metered units of 23-plans-free-and-paid.md §6.
export const USAGE_KINDS = [
  'welcome_analysis',
  'full_analysis',
  'lite_analysis',
  'extra_instrument',
] as const
export type UsageKind = (typeof USAGE_KINDS)[number]

// Cache of the billing provider's state (the provider is the source of truth).
export const subscriptions = pgTable(
  'subscriptions',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id'),
    providerSubscriptionId: text('provider_subscription_id'),
    plan: text('plan', { enum: values(Plan) }).notNull(),
    status: text('status', { enum: values(SubscriptionStatus) }).notNull(),
    currentPeriodStart: timestamptz('current_period_start'),
    currentPeriodEnd: timestamptz('current_period_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    // The period end the annual renewal reminder was sent for (14 §4.3: once per renewal).
    renewalReminderFor: timestamptz('renewal_reminder_for'),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('subscriptions_plan_check', oneOf(t.plan, values(Plan))),
    check('subscriptions_status_check', oneOf(t.status, values(SubscriptionStatus))),
  ],
)

export const usageLedger = pgTable(
  'usage_ledger',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    kind: text('kind', { enum: USAGE_KINDS }).notNull(),
    analysisId: uuid('analysis_id').references(() => analyses.id, { onDelete: 'set null' }),
    units: integer('units').notNull().default(1),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('usage_ledger_user_period_idx').on(t.userId, t.periodStart),
    check('usage_ledger_kind_check', oneOf(t.kind, USAGE_KINDS)),
  ],
)

// Provider events already applied (14 §3: the webhook is idempotent by event id).
export const billingEvents = pgTable(
  'billing_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    type: text('type').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamptz('received_at').notNull().defaultNow(),
  },
  (t) => [index('billing_events_user_idx').on(t.userId, t.receivedAt)],
)
