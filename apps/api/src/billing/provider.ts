import type { BillingEvent, PaidPlan } from '@splitune/contracts'
import type { z } from 'zod'

// The provider-agnostic payment interface of 14 §3. Personal mode has one implementation,
// MockBillingProvider (25 §2); Stripe Managed Payments and Paddle are the dormant path.

export type PaidPlanName = z.infer<typeof PaidPlan>
export type NormalisedEvent = z.infer<typeof BillingEvent>

export interface BillingProvider {
  readonly name: 'mock'
  createCheckout(input: {
    userId: string
    plan: PaidPlanName
    successUrl: string
    cancelUrl: string
  }): Promise<{ url: string }>
  createPortal(input: { userId: string; returnUrl: string }): Promise<{ url: string }>
  // The normalised event of a webhook request; throws WebhookRejected for anything unverified.
  verifyWebhook(req: Request): Promise<NormalisedEvent>
}

export class WebhookRejected extends Error {
  readonly reason: 'signature' | 'payload'
  constructor(reason: 'signature' | 'payload') {
    super(`billing webhook rejected: ${reason}`)
    this.name = 'WebhookRejected'
    this.reason = reason
  }
}

const DAY_MS = 86_400_000

// One billing interval later, in UTC; the day is clamped to the target month's length
// (31 Jan + 1 month = 28/29 Feb).
export function addInterval(date: Date, plan: PaidPlanName): Date {
  const months = plan === 'paid_yearly' ? 12 : 1
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(
    Date.UTC(
      y,
      m,
      Math.min(date.getUTCDate(), lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ),
  )
}

export const daysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS))
