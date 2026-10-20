import { z } from 'zod'

export const PaidPlan = z.enum(['paid_monthly', 'paid_yearly'])
export const Plan = z.enum(['free', ...PaidPlan.options])

export const BillingPlan = z.object({
  plan: PaidPlan,
  interval: z.enum(['month', 'year']),
  price_minor: z.number().int().nonnegative(), // e.g. 999 = 9.99 in `currency`
  currency: z.string().regex(/^[A-Z]{3}$/),
})

export const BillingPlansOutput = z.object({
  provider: z.enum(['mock', 'stripe', 'paddle']),
  plans: z.array(BillingPlan),
})

export const CheckoutInput = z.object({ plan: PaidPlan })

// Normalised provider event posted to /internal/billing/webhook (HMAC-signed). The mock checkout
// and portal pages emit these too, so entitlement code runs unchanged in personal mode.
const PeriodEvent = z.object({
  user_id: z.string().min(1),
  plan: PaidPlan,
  period_start: z.iso.datetime(),
  period_end: z.iso.datetime(),
  cancel_at_period_end: z.boolean(),
})

export const BillingEvent = z.discriminatedUnion('type', [
  PeriodEvent.extend({ type: z.literal('subscription.activated') }),
  PeriodEvent.extend({ type: z.literal('subscription.renewed') }),
  PeriodEvent.extend({ type: z.literal('subscription.updated') }),
  z.object({
    type: z.enum(['subscription.cancelled', 'subscription.expired', 'payment.failed']),
    user_id: z.string().min(1),
    at: z.iso.datetime(),
  }),
  z.object({
    type: z.literal('refund.issued'),
    user_id: z.string().min(1),
    amount_minor: z.number().int().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
])

// POST /internal/dev/clock (dev/admin only, mock mode): advance the billing clock.
export const DevClockInput = z.object({ advance_days: z.number().int().min(1).max(3660) })
export const DevClockOutput = z.object({ now: z.iso.datetime() })
