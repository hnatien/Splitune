import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { BillingEvent, type MockPortalAction } from '@splitune/contracts'
import type { Subscription } from '@splitune/db'
import type { z } from 'zod'
import type { Clock } from '../clock.ts'
import {
  addInterval,
  type BillingProvider,
  type NormalisedEvent,
  type PaidPlanName,
  WebhookRejected,
} from './provider.ts'

// MockBillingProvider (25 §2): checkout and portal are local pages whose buttons make this
// provider emit the events a real one would, HMAC-signed and POSTed to /internal/billing/webhook,
// so the webhook handler and the entitlement code run unchanged. It also plays the provider's
// scheduler: renewing or expiring periods that ended on the billing clock. No card data, ever.

export const SIGNATURE_HEADER = 'splitune-signature'
// Signatures older than this are refused (replays); real time, not the billing clock.
const SIGNATURE_TOLERANCE_S = 300
// A checkout or portal session link works for an hour.
const SESSION_TTL_MS = 3_600_000
// Renewals emitted for one subscription in one pass at most (a dev clock jump of years).
const MAX_RENEWALS = 120

export const CHECKOUT_PATH = '/billing/mock-checkout'
export const PORTAL_PATH = '/billing/mock-portal'

export interface MockSessionData {
  kind: 'checkout' | 'portal'
  userId: string
  plan: PaidPlanName | null
  returnUrl: string
  cancelUrl: string | null
}

export type PortalAction = z.infer<typeof MockPortalAction>

export class MockSessionInvalid extends Error {
  constructor() {
    super('mock billing session invalid')
    this.name = 'MockSessionInvalid'
  }
}

export interface MockBillingProvider extends BillingProvider {
  // The session behind a checkout/portal link, if it is valid, current and the user's own.
  session(token: string, userId: string): MockSessionData
  // The event behind the checkout page's success button (declined and cancel create nothing).
  checkout(token: string, session: MockSessionData): NormalisedEvent
  portal(
    session: MockSessionData,
    action: PortalAction,
    subscription: Subscription,
  ): NormalisedEvent
  // Renewal or expiry events for a subscription whose period ended by `now`.
  due(subscription: Subscription, now: Date): NormalisedEvent[]
  // A signed webhook request body, as the provider would POST it.
  sign(event: NormalisedEvent, at?: Date): { body: string; signature: string }
}

const iso = (date: Date) => date.toISOString()
const b64 = (text: string) => Buffer.from(text).toString('base64url')

export function createMockProvider({
  secret,
  clock,
  priceMinor,
  currency,
}: {
  secret: string
  clock: Clock
  priceMinor: Record<PaidPlanName, number>
  currency: string
}): MockBillingProvider {
  const mac = (purpose: string, data: string) =>
    createHmac('sha256', secret).update(`${purpose}.${data}`).digest()

  function issue(data: MockSessionData, path: string): { url: string } {
    const payload = b64(JSON.stringify({ ...data, exp: Date.now() + SESSION_TTL_MS }))
    const token = `${payload}.${mac('session', payload).toString('base64url')}`
    return { url: `${path}?session=${encodeURIComponent(token)}` }
  }

  const periodEvent = (
    type: 'subscription.activated' | 'subscription.renewed' | 'subscription.updated',
    id: string,
    sub: { userId: string; plan: PaidPlanName; start: Date; end: Date; cancel: boolean },
  ): NormalisedEvent => ({
    type,
    id,
    user_id: sub.userId,
    plan: sub.plan,
    period_start: iso(sub.start),
    period_end: iso(sub.end),
    cancel_at_period_end: sub.cancel,
  })

  const paidPlan = (subscription: Subscription): PaidPlanName =>
    subscription.plan === 'paid_yearly' ? 'paid_yearly' : 'paid_monthly'

  return {
    name: 'mock',

    async createCheckout({ userId, plan, successUrl, cancelUrl }) {
      return issue(
        { kind: 'checkout', userId, plan, returnUrl: successUrl, cancelUrl },
        CHECKOUT_PATH,
      )
    },

    async createPortal({ userId, returnUrl }) {
      return issue({ kind: 'portal', userId, plan: null, returnUrl, cancelUrl: null }, PORTAL_PATH)
    },

    async verifyWebhook(req) {
      const header = req.headers.get(SIGNATURE_HEADER) ?? ''
      const parts = new Map(
        header.split(',').map((part) => {
          const at = part.indexOf('=')
          return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const
        }),
      )
      const t = Number(parts.get('t'))
      const given = Buffer.from(parts.get('v1') ?? '', 'hex')
      const body = await req.text()
      const expected = mac('webhook', `${parts.get('t')}.${body}`)
      if (
        !Number.isSafeInteger(t) ||
        Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_S ||
        given.length !== expected.length ||
        !timingSafeEqual(given, expected)
      ) {
        throw new WebhookRejected('signature')
      }
      let json: unknown
      try {
        json = JSON.parse(body)
      } catch {
        throw new WebhookRejected('payload')
      }
      const parsed = BillingEvent.safeParse(json)
      if (!parsed.success) throw new WebhookRejected('payload')
      return parsed.data
    },

    session(token, userId) {
      const [payload = '', signature = ''] = token.split('.')
      const given = Buffer.from(signature, 'base64url')
      const expected = mac('session', payload)
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw new MockSessionInvalid()
      }
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as MockSessionData & {
        exp: number
      }
      if (data.exp < Date.now() || data.userId !== userId) throw new MockSessionInvalid()
      const { exp: _, ...session } = data
      return session
    },

    checkout(token, session) {
      if (session.kind !== 'checkout' || session.plan === null) throw new MockSessionInvalid()
      const start = clock.now()
      // One activation per checkout session, however often its button is pressed.
      const id = `evt_checkout_${createHash('sha256').update(token).digest('hex').slice(0, 32)}`
      return periodEvent('subscription.activated', id, {
        userId: session.userId,
        plan: session.plan,
        start,
        end: addInterval(start, session.plan),
        cancel: false,
      })
    },

    portal(session, action, subscription) {
      const id = `evt_${randomUUID()}`
      const userId = session.userId
      const plan = paidPlan(subscription)
      const period = {
        userId,
        plan,
        start: subscription.currentPeriodStart ?? clock.now(),
        end: subscription.currentPeriodEnd ?? clock.now(),
        cancel: subscription.cancelAtPeriodEnd,
      }
      switch (action) {
        case 'cancel':
          return periodEvent('subscription.updated', id, { ...period, cancel: true })
        case 'resume':
          return periodEvent('subscription.updated', id, { ...period, cancel: false })
        // The new interval applies from the next renewal; this period keeps its dates.
        case 'switch':
          return periodEvent('subscription.updated', id, {
            ...period,
            plan: plan === 'paid_yearly' ? 'paid_monthly' : 'paid_yearly',
          })
        case 'payment_failed':
          return { type: 'payment.failed', id, user_id: userId, at: iso(clock.now()) }
        case 'refund':
          return {
            type: 'refund.issued',
            id,
            user_id: userId,
            amount_minor: priceMinor[plan],
            currency,
          }
      }
    },

    due(subscription, now) {
      const end = subscription.currentPeriodEnd
      if (!end || end > now) return []
      const userId = subscription.userId
      // Ids follow the period, so concurrent passes emit each change once.
      if (subscription.cancelAtPeriodEnd || subscription.status === 'past_due') {
        return [
          {
            type: 'subscription.expired',
            id: `evt_expire_${userId}_${end.getTime()}`,
            user_id: userId,
            at: iso(end),
          },
        ]
      }
      const plan = paidPlan(subscription)
      const events: NormalisedEvent[] = []
      let start = end
      while (start <= now && events.length < MAX_RENEWALS) {
        const next = addInterval(start, plan)
        events.push(
          periodEvent('subscription.renewed', `evt_renew_${userId}_${start.getTime()}`, {
            userId,
            plan,
            start,
            end: next,
            cancel: false,
          }),
        )
        start = next
      }
      return events
    },

    sign(event, at = new Date()) {
      const body = JSON.stringify(event)
      const t = Math.floor(at.getTime() / 1000)
      const v1 = mac('webhook', `${t}.${body}`).toString('hex')
      return { body, signature: `t=${t},v1=${v1}` }
    },
  }
}
