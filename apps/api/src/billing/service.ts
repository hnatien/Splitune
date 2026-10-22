import { type Database, dueSubscriptions, type Repositories } from '@splitune/db'
import type { Clock } from '../clock.ts'
import type { ApiConfig } from '../config.ts'
import type { Logger } from '../logger.ts'
import type { Mail, Mailer } from '../mailer.ts'
import { cancellationConfirmed, paymentFailed, price, renewalReminder } from './emails.ts'
import type { MockBillingProvider } from './mock.ts'
import { daysBetween, type NormalisedEvent } from './provider.ts'

// Billing for the API (14 §3–§4): applies verified provider events to the subscription cache with
// their side effects (emails, analytics), and settles what is due on the billing clock: the
// provider's renewals and expiries (the mock plays the provider) and our annual renewal reminders.

// Yearly renewal reminder lead time (14 §4.3: 7–14 days).
export const REMINDER_DAYS = 7
const DAY_MS = 86_400_000

export interface Billing {
  provider: MockBillingProvider
  clock: Clock
  // Applies a verified event once (idempotent by event id); false = seen before.
  handle(event: NormalisedEvent): Promise<boolean>
  // Sends a provider event through the webhook, as the provider would.
  emit(event: NormalisedEvent): Promise<void>
  // Renewals, expiries and reminders due now, for one user or everyone.
  settle(options?: { userId?: string }): Promise<void>
}

export function createBilling({
  db,
  repos,
  config,
  mailer,
  clock,
  provider,
  log,
  analyticsHash,
  post,
}: {
  db: Database
  repos: Repositories
  config: ApiConfig
  mailer: Mailer
  clock: Clock
  provider: MockBillingProvider
  log: Logger
  analyticsHash: (userId: string) => string
  // POSTs a signed body to /internal/billing/webhook.
  post: (body: string, signature: string) => Promise<Response>
}): Billing {
  const billingUrl = `${config.appUrl}/settings/billing`

  async function mail(userId: string, build: (to: string) => Mail) {
    try {
      const user = await repos.users.get(userId)
      if (user) await mailer.send(build(user.email))
    } catch (error) {
      // The event is applied either way; a lost email is logged, not retried.
      log.error({ err_name: (error as Error).name }, 'billing email failed')
    }
  }

  async function emit(event: NormalisedEvent) {
    const { body, signature } = provider.sign(event)
    const res = await post(body, signature)
    if (!res.ok) throw new Error(`billing webhook answered ${res.status}`)
  }

  return {
    provider,
    clock,
    emit,

    async handle(event) {
      const userId = event.user_id
      const { applied, before, after } = await repos.billing.applyEvent(
        userId,
        provider.name,
        event,
      )
      if (!applied) return false
      const cancelled =
        (event.type === 'subscription.updated' &&
          !before?.cancelAtPeriodEnd &&
          after?.cancelAtPeriodEnd === true) ||
        (event.type === 'subscription.cancelled' && before?.status !== 'cancelled')
      if (event.type === 'subscription.activated') {
        await repos.analytics.record(analyticsHash(userId), [
          { name: 'checkout_completed', props: { plan: event.plan } },
        ])
      }
      if (cancelled) {
        const since = await repos.billing.firstActivation(userId)
        await repos.analytics.record(analyticsHash(userId), [
          {
            name: 'subscription_cancelled',
            props: { tenure_days: since ? daysBetween(since, clock.now()) : 0 },
          },
        ])
        await mail(userId, (to) =>
          cancellationConfirmed({
            to,
            activeUntil:
              event.type === 'subscription.updated'
                ? (after?.currentPeriodEnd ?? undefined)
                : undefined,
            billingUrl,
          }),
        )
      }
      if (event.type === 'payment.failed') {
        await mail(userId, (to) => paymentFailed({ to, billingUrl }))
      }
      return true
    },

    async settle({ userId } = {}) {
      const now = clock.now()
      const remindFrom = new Date(now.getTime() + REMINDER_DAYS * DAY_MS)
      const due = await dueSubscriptions(db, {
        now,
        remindFrom,
        ...(userId === undefined ? {} : { userId }),
      })
      for (const subscription of due) {
        for (const event of provider.due(subscription, now)) await emit(event)
        const end = subscription.currentPeriodEnd
        if (
          subscription.plan === 'paid_yearly' &&
          !subscription.cancelAtPeriodEnd &&
          end &&
          end > now &&
          end <= remindFrom &&
          (await repos.billing.markRenewalReminded(subscription.userId, end))
        ) {
          await mail(subscription.userId, (to) =>
            renewalReminder({
              to,
              plan: 'paid_yearly',
              renewsAt: end,
              amount: price(config.billing.priceMinor.paid_yearly, config.billing.currency),
              billingUrl,
            }),
          )
        }
      }
    },
  }
}
