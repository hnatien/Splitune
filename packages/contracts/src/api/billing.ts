import { z } from 'zod'
import { PaidPlan } from './plan.ts'

export const BillingPlan = z.object({
  plan: PaidPlan,
  interval: z.enum(['month', 'year']),
  price_minor: z.number().int().nonnegative(), // e.g. 999 = 9.99 in `currency`
  currency: z.string().regex(/^[A-Z]{3}$/),
})

// What each plan includes per period (23 §2; remote-configurable, so never hard-coded in clients).
export const PlanAllowances = z.object({
  welcome: z.number().int().nonnegative(),
  free_lite_per_month: z.number().int().nonnegative(),
  plus_full_per_period: z.number().int().nonnegative(),
})

export const BillingPlansOutput = z.object({
  provider: z.enum(['mock', 'stripe', 'paddle']),
  plans: z.array(BillingPlan),
  allowances: PlanAllowances,
})

// A same-origin path (no scheme, no `//host`, no backslashes).
const AppPath = z
  .string()
  .max(500)
  .regex(/^\/(?!\/)[^\s\\]*$/)

// return_path: where a cancelled checkout goes back to (default /pricing).
export const CheckoutInput = z.object({ plan: PaidPlan, return_path: AppPath.optional() })

// Normalised provider event posted to /internal/billing/webhook (HMAC-signed). The mock checkout
// and portal pages emit these too, so entitlement code runs unchanged in personal mode. `id` is the
// provider's event id: the handler applies each id once (14 §3 "store raw event id").
const EventId = z.string().min(1).max(200)

const PeriodEvent = z.object({
  id: EventId,
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
    id: EventId,
    user_id: z.string().min(1),
    at: z.iso.datetime(),
  }),
  z.object({
    type: z.literal('refund.issued'),
    id: EventId,
    user_id: z.string().min(1),
    amount_minor: z.number().int().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
])

// Mock checkout and portal (25 §2): the pages hold an opaque session from createCheckout /
// createPortal and ask the API to emit the simulated provider's events for it.
export const MockSessionInput = z.object({ session: z.string().min(1).max(2000) })

export const MockSession = z.object({
  kind: z.enum(['checkout', 'portal']),
  // The plan being bought (checkout only).
  plan: PaidPlan.nullable(),
  // Where the page sends the user back to (same-origin path).
  return_url: z.string().min(1),
})

export const MockCheckoutInput = MockSessionInput.extend({
  outcome: z.enum(['success', 'declined', 'cancel']),
})

export const MockCheckoutOutput = z.object({
  outcome: z.enum(['success', 'declined', 'cancel']),
  // Where to go next; null = stay on the checkout page (declined).
  url: z.string().min(1).nullable(),
})

export const MockPortalAction = z.enum(['cancel', 'resume', 'switch', 'payment_failed', 'refund'])

export const MockPortalInput = MockSessionInput.extend({ action: MockPortalAction })

export const MockPortalOutput = z.object({ action: MockPortalAction })

// POST /internal/dev/clock (dev/admin only, mock mode): advance the billing clock.
export const DevClockInput = z.object({ advance_days: z.number().int().min(1).max(3660) })
export const DevClockOutput = z.object({ now: z.iso.datetime() })
