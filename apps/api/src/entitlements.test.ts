import type { Subscription } from '@splitune/db'
import { describe, expect, it } from 'vitest'
import { entitlementsFor, planOf, usagePeriod } from './entitlements.ts'

const now = new Date('2026-10-20T12:00:00Z')

const subscription = (patch: Partial<Subscription>): Subscription => ({
  userId: 'u1',
  provider: 'mock',
  providerCustomerId: null,
  providerSubscriptionId: null,
  plan: 'paid_monthly',
  status: 'active',
  currentPeriodStart: new Date('2026-10-05T00:00:00Z'),
  currentPeriodEnd: new Date('2026-11-05T00:00:00Z'),
  cancelAtPeriodEnd: false,
  updatedAt: now,
  ...patch,
})

describe('planOf', () => {
  it('is free without a live paid subscription', () => {
    expect(planOf(undefined, now)).toBe('free')
    expect(planOf(subscription({ status: 'cancelled' }), now)).toBe('free')
    expect(planOf(subscription({ status: 'expired' }), now)).toBe('free')
    expect(planOf(subscription({ currentPeriodEnd: new Date('2026-10-01T00:00:00Z') }), now)).toBe(
      'free',
    )
  })

  it('keeps Plus while active, trialing or past due', () => {
    expect(planOf(subscription({}), now)).toBe('paid_monthly')
    expect(planOf(subscription({ status: 'past_due', plan: 'paid_yearly' }), now)).toBe(
      'paid_yearly',
    )
  })
})

describe('entitlementsFor', () => {
  it('never gates the embed or core practice', () => {
    for (const plan of ['free', 'paid_monthly'] as const) {
      expect(entitlementsFor(plan)).toEqual(expect.arrayContaining(['practice.core', 'embed.view']))
    }
    expect(entitlementsFor('free')).not.toContain('analysis.full')
    expect(entitlementsFor('paid_yearly')).not.toContain('analysis.welcome')
  })
})

describe('usagePeriod', () => {
  it('uses the UTC calendar month for Free', () => {
    expect(usagePeriod('free', undefined, now)).toEqual({
      start: '2026-10-01',
      resetsAt: new Date('2026-11-01T00:00:00Z'),
    })
    expect(usagePeriod('free', undefined, new Date('2026-12-31T23:59:59Z')).resetsAt).toEqual(
      new Date('2027-01-01T00:00:00Z'),
    )
  })

  it('uses the subscription period for Plus', () => {
    expect(usagePeriod('paid_monthly', subscription({}), now)).toEqual({
      start: '2026-10-05',
      resetsAt: new Date('2026-11-05T00:00:00Z'),
    })
  })
})
