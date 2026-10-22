import type { MockSession } from '@splitune/contracts'
import type { z } from 'zod'
import { type MockSessionData, MockSessionInvalid } from '../billing/mock.ts'
import { limitsFrom, planOf } from '../entitlements.ts'
import { apiError } from '../errors.ts'
import { type ApiDeps, authed, pub } from '../procedures.ts'

// Billing (04 "Billing", 14 §3): plans and prices, checkout and portal links from the provider,
// and the mock pages' actions (25 §2). Entitlements change only through the webhook.

const SUCCESS_PATH = '/settings/billing?checkout=success'
const BILLING_PATH = '/settings/billing'

function sessionOf(deps: ApiDeps, token: string, userId: string): MockSessionData {
  try {
    return deps.billing.provider.session(token, userId)
  } catch (error) {
    if (error instanceof MockSessionInvalid) {
      throw apiError('not_found', { details: { reason: 'billing_session_invalid' } })
    }
    throw error
  }
}

const toSession = (session: MockSessionData): z.infer<typeof MockSession> => ({
  kind: session.kind,
  plan: session.plan,
  return_url: session.returnUrl,
})

export const billing = {
  plans: pub.billing.plans.handler(async ({ context }) => {
    const { billing } = context.deps.config
    const limits = limitsFrom(await context.deps.repos.flags.list())
    return {
      provider: billing.provider,
      plans: [
        {
          plan: 'paid_monthly' as const,
          interval: 'month' as const,
          price_minor: billing.priceMinor.paid_monthly,
          currency: billing.currency,
        },
        {
          plan: 'paid_yearly' as const,
          interval: 'year' as const,
          price_minor: billing.priceMinor.paid_yearly,
          currency: billing.currency,
        },
      ],
      allowances: {
        welcome: limits.welcomeLifetime,
        free_lite_per_month: limits.freeLitePerPeriod,
        plus_full_per_period: limits.plusFullPerPeriod,
      },
    }
  }),

  checkout: authed.billing.checkout.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const subscription = await deps.repos.billing.subscription(userId)
    if (planOf(subscription, deps.billing.clock.now()) !== 'free') {
      throw apiError('conflict', {
        message: 'Already on Plus.',
        details: { reason: 'already_subscribed' },
      })
    }
    return deps.billing.provider.createCheckout({
      userId,
      plan: input.plan,
      successUrl: SUCCESS_PATH,
      cancelUrl: input.return_path ?? '/pricing',
    })
  }),

  portal: authed.billing.portal.handler(async ({ context }) => {
    const { deps, userId } = context
    if (!(await deps.repos.billing.subscription(userId))) throw apiError('not_found')
    return deps.billing.provider.createPortal({ userId, returnUrl: BILLING_PATH })
  }),

  mockSession: authed.billing.mockSession.handler(({ context, input }) =>
    toSession(sessionOf(context.deps, input.session, context.userId)),
  ),

  mockCheckout: authed.billing.mockCheckout.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const session = sessionOf(deps, input.session, userId)
    if (session.kind !== 'checkout') throw apiError('not_found')
    switch (input.outcome) {
      case 'success': {
        const event = deps.billing.provider.checkout(input.session, session)
        // The same session again activates nothing new; another one can't buy Plus twice.
        const subscription = await deps.repos.billing.subscription(userId)
        if (
          planOf(subscription, deps.billing.clock.now()) !== 'free' &&
          !(await deps.repos.billing.hasEvent(userId, event.id))
        ) {
          throw apiError('conflict', {
            message: 'Already on Plus.',
            details: { reason: 'already_subscribed' },
          })
        }
        await deps.billing.emit(event)
        return { outcome: input.outcome, url: session.returnUrl }
      }
      // A declined card creates nothing at the provider: the page offers another try.
      case 'declined':
        return { outcome: input.outcome, url: null }
      case 'cancel':
        return { outcome: input.outcome, url: session.cancelUrl ?? '/pricing' }
    }
  }),

  mockPortal: authed.billing.mockPortal.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const session = sessionOf(deps, input.session, userId)
    if (session.kind !== 'portal') throw apiError('not_found')
    const subscription = await deps.repos.billing.subscription(userId)
    const live = planOf(subscription, deps.billing.clock.now()) !== 'free'
    const pointless =
      (input.action === 'cancel' && subscription?.cancelAtPeriodEnd) ||
      (input.action === 'resume' && !subscription?.cancelAtPeriodEnd)
    if (!subscription || !live || pointless) {
      throw apiError('conflict', { details: { reason: 'subscription_state' } })
    }
    await deps.billing.emit(deps.billing.provider.portal(session, input.action, subscription))
    return { action: input.action }
  }),
}
