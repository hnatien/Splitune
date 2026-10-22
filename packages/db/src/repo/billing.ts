import type { BillingEvent } from '@splitune/contracts'
import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { type Database, withUser } from '../client.ts'
import { billingEvents, subscriptions } from '../schema/index.ts'
import type { Subscription } from './users.ts'

type Event = z.infer<typeof BillingEvent>

export interface AppliedBillingEvent {
  // false: this event id was applied before (the webhook is idempotent).
  applied: boolean
  before: Subscription | undefined
  after: Subscription | undefined
}

// Statuses with a period still running: renewals, expiry and reminders apply to these.
const LIVE_STATUSES = ['active', 'trialing', 'past_due'] as const

// The subscriptions cache (14 §3: the provider is the source of truth; its normalised webhook
// events are the only writer).
export function billingRepo(db: Database) {
  return {
    subscription: (userId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx.select().from(subscriptions).where(eq(subscriptions.userId, userId))
        return row
      }),

    // Records the event id and applies the event to the user's subscription in one transaction.
    applyEvent: (userId: string, provider: string, event: Event) =>
      withUser(db, userId, async (tx): Promise<AppliedBillingEvent> => {
        const [recorded] = await tx
          .insert(billingEvents)
          .values({ id: event.id, provider, type: event.type, userId, payload: event })
          .onConflictDoNothing()
          .returning({ id: billingEvents.id })
        const [before] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .for('update')
        if (!recorded) return { applied: false, before, after: before }
        const updatedAt = new Date()
        let after = before
        switch (event.type) {
          case 'subscription.activated':
          case 'subscription.renewed':
          case 'subscription.updated': {
            const period = {
              plan: event.plan,
              currentPeriodStart: new Date(event.period_start),
              currentPeriodEnd: new Date(event.period_end),
              cancelAtPeriodEnd: event.cancel_at_period_end,
              updatedAt,
            }
            // An update keeps the status (e.g. past due); activation and renewal mean paid.
            const status =
              event.type === 'subscription.updated' && before ? before.status : 'active'
            ;[after] = await tx
              .insert(subscriptions)
              .values({ userId, provider, status, ...period })
              .onConflictDoUpdate({
                target: subscriptions.userId,
                set: { provider, status, ...period },
              })
              .returning()
            break
          }
          case 'subscription.cancelled':
          case 'subscription.expired':
          case 'payment.failed': {
            if (!before) break
            const status = {
              'subscription.cancelled': 'cancelled',
              'subscription.expired': 'expired',
              'payment.failed': 'past_due',
            } as const
            ;[after] = await tx
              .update(subscriptions)
              .set({ status: status[event.type], updatedAt })
              .where(eq(subscriptions.userId, userId))
              .returning()
            break
          }
          case 'refund.issued':
            break
        }
        return { applied: true, before, after }
      }),

    hasEvent: (userId: string, eventId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select({ id: billingEvents.id })
          .from(billingEvents)
          .where(and(eq(billingEvents.userId, userId), eq(billingEvents.id, eventId)))
        return row !== undefined
      }),

    // When the user first became a subscriber (the period start of the earliest activation).
    firstActivation: (userId: string) =>
      withUser(db, userId, async (tx) => {
        const [row] = await tx
          .select({ at: sql<string | null>`min(${billingEvents.payload} ->> 'period_start')` })
          .from(billingEvents)
          .where(
            and(eq(billingEvents.userId, userId), eq(billingEvents.type, 'subscription.activated')),
          )
        return row?.at ? new Date(row.at) : undefined
      }),

    // Once per renewal: true when this call marked the reminder for `periodEnd` as sent.
    markRenewalReminded: (userId: string, periodEnd: Date) =>
      withUser(db, userId, async (tx) => {
        const rows = await tx
          .update(subscriptions)
          .set({ renewalReminderFor: periodEnd })
          .where(
            and(
              eq(subscriptions.userId, userId),
              eq(subscriptions.currentPeriodEnd, periodEnd),
              or(
                isNull(subscriptions.renewalReminderFor),
                sql`${subscriptions.renewalReminderFor} <> ${periodEnd}`,
              ),
            ),
          )
          .returning({ userId: subscriptions.userId })
        return rows.length === 1
      }),
  }
}

// Subscriptions the billing provider has to act on at `now` across all users: a period that has
// ended (renew or expire) or a yearly renewal within `remindFrom` (14 §4.3). Runs as the table
// owner, like the queue's system-wide reads; the mock provider uses it to play the provider's part.
export async function dueSubscriptions(
  db: Database,
  { now, remindFrom, userId }: { now: Date; remindFrom: Date; userId?: string },
): Promise<Subscription[]> {
  return db
    .select()
    .from(subscriptions)
    .where(
      and(
        userId === undefined ? undefined : eq(subscriptions.userId, userId),
        inArray(subscriptions.status, [...LIVE_STATUSES]),
        or(
          lte(subscriptions.currentPeriodEnd, now),
          and(
            eq(subscriptions.plan, 'paid_yearly'),
            eq(subscriptions.cancelAtPeriodEnd, false),
            lte(subscriptions.currentPeriodEnd, remindFrom),
            or(
              isNull(subscriptions.renewalReminderFor),
              sql`${subscriptions.renewalReminderFor} <> ${subscriptions.currentPeriodEnd}`,
            ),
          ),
        ),
      ),
    )
}
