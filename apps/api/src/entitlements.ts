import type { EntitlementKey, Plan } from '@splitune/contracts'
import type { Subscription } from '@splitune/db'
import type { z } from 'zod'

// Plans and allowances of 23-plans-free-and-paid.md and 14-auth-billing-and-entitlements.md §2.
// Pure functions of the cached subscription and the clock; step 14 adds admission (reservations in
// usage_ledger) and remote-configured caps on top.

type PlanName = z.infer<typeof Plan>
type Key = z.infer<typeof EntitlementKey>

// cap null = no cap (Plus Lite is fair use).
export const ALLOWANCES = {
  free: { welcome: 1, full: 0, lite: 5 },
  paid: { welcome: 0, full: 15, lite: null },
} as const

const FREE_KEYS: Key[] = ['practice.core', 'analysis.welcome', 'analysis.lite', 'embed.view']
const PAID_KEYS: Key[] = [
  'practice.core',
  'analysis.full',
  'analysis.lite',
  'analysis.extra_instrument',
  'processing.priority',
  'mic.scoring',
  'midi.wait_mode',
  'offline',
  'export',
  'embed.view',
]

// Statuses that keep Plus: past_due is the provider's retry window.
const PAID_STATUSES = new Set<Subscription['status']>(['active', 'trialing', 'past_due'])

export function planOf(subscription: Subscription | undefined, now: Date): PlanName {
  if (!subscription || subscription.plan === 'free') return 'free'
  if (!PAID_STATUSES.has(subscription.status)) return 'free'
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now) return 'free'
  return subscription.plan
}

export const entitlementsFor = (plan: PlanName): Key[] => (plan === 'free' ? FREE_KEYS : PAID_KEYS)

export interface UsagePeriod {
  // usage_ledger.period_start (a date)
  start: string
  resetsAt: Date | null
}

// Free: calendar month in UTC (the user's time zone is not stored yet). Plus: the subscription
// period.
export function usagePeriod(
  plan: PlanName,
  subscription: Subscription | undefined,
  now: Date,
): UsagePeriod {
  if (plan !== 'free' && subscription?.currentPeriodStart) {
    return {
      start: subscription.currentPeriodStart.toISOString().slice(0, 10),
      resetsAt: subscription.currentPeriodEnd,
    }
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { start: start.toISOString().slice(0, 10), resetsAt: next }
}
