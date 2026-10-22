import type { Subscription } from '@splitune/db'
import { describe, expect, it } from 'vitest'
import {
  admit,
  DEFAULT_LIMITS,
  entitlements,
  entitlementsFor,
  type LedgerUnits,
  limitsFrom,
  PRIORITY,
  planOf,
  usagePeriod,
} from './entitlements.ts'

const now = new Date('2026-10-20T12:00:00Z')

const subscription = (patch: Partial<Subscription> = {}): Subscription => ({
  userId: 'u1',
  provider: 'mock',
  providerCustomerId: null,
  providerSubscriptionId: null,
  plan: 'paid_monthly',
  status: 'active',
  currentPeriodStart: new Date('2026-10-05T00:00:00Z'),
  currentPeriodEnd: new Date('2026-11-05T00:00:00Z'),
  cancelAtPeriodEnd: false,
  renewalReminderFor: null,
  updatedAt: now,
  ...patch,
})

const units = (kind: LedgerUnits['kind'], periodStart: string, n: number): LedgerUnits => ({
  kind,
  periodStart,
  units: n,
})

const ent = (sub: Subscription | undefined, ledger: LedgerUnits[], limits = DEFAULT_LIMITS) =>
  entitlements({ subscription: sub, ledger, limits }, now)

describe('planOf', () => {
  it('is free without a live paid subscription', () => {
    expect(planOf(undefined, now)).toBe('free')
    expect(planOf(subscription({ status: 'cancelled' }), now)).toBe('free')
    expect(planOf(subscription({ status: 'expired' }), now)).toBe('free')
    expect(planOf(subscription({ plan: 'free' }), now)).toBe('free')
    expect(planOf(subscription({ currentPeriodEnd: new Date('2026-10-01T00:00:00Z') }), now)).toBe(
      'free',
    )
    // The period end itself is already Free.
    expect(planOf(subscription({ currentPeriodEnd: now }), now)).toBe('free')
  })

  it('keeps Plus while active, trialing, past due or cancelling at period end', () => {
    expect(planOf(subscription(), now)).toBe('paid_monthly')
    expect(planOf(subscription({ status: 'trialing' }), now)).toBe('paid_monthly')
    expect(planOf(subscription({ status: 'past_due', plan: 'paid_yearly' }), now)).toBe(
      'paid_yearly',
    )
    expect(planOf(subscription({ cancelAtPeriodEnd: true }), now)).toBe('paid_monthly')
  })
})

describe('entitlementsFor', () => {
  it('never gates the embed or core practice', () => {
    for (const plan of ['free', 'paid_monthly', 'paid_yearly'] as const) {
      expect(entitlementsFor(plan)).toEqual(expect.arrayContaining(['practice.core', 'embed.view']))
    }
    expect(entitlementsFor('free')).not.toContain('analysis.full')
    expect(entitlementsFor('free')).not.toContain('processing.priority')
    expect(entitlementsFor('paid_yearly')).not.toContain('analysis.welcome')
    expect(entitlementsFor('paid_monthly')).toContain('processing.priority')
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
    expect(usagePeriod('paid_monthly', subscription(), now)).toEqual({
      start: '2026-10-05',
      resetsAt: new Date('2026-11-05T00:00:00Z'),
    })
  })
})

describe('limitsFrom', () => {
  it('takes enabled integer flags over the defaults and ignores anything else', () => {
    expect(limitsFrom([])).toEqual(DEFAULT_LIMITS)
    expect(
      limitsFrom([
        { key: 'plan.free.lite_per_month', enabled: true, value: 3 },
        { key: 'plan.plus.full_per_month', enabled: false, value: 30 },
        { key: 'plan.plus.lite_fair_use', enabled: true, value: -1 },
        { key: 'plan.free.standard_stems_enabled', enabled: true, value: true },
      ]),
    ).toEqual({ ...DEFAULT_LIMITS, freeLitePerPeriod: 3 })
    expect(limitsFrom([{ key: 'plan.plus.full_per_month', enabled: true, value: 2.5 }])).toEqual(
      DEFAULT_LIMITS,
    )
  })
})

describe('entitlements', () => {
  // Free: one lifetime Welcome, 5 Lite per calendar month, no Full; Plus: 15 Full per period,
  // Lite unlimited to the learner (fair use 200), no Welcome.
  it.each([
    {
      name: 'Free, nothing used',
      sub: undefined,
      ledger: [],
      usage: {
        welcome_available: true,
        full: { used: 0, cap: 0 },
        lite: { used: 0, cap: 5 },
      },
    },
    {
      name: 'Free, Welcome used in an earlier month',
      sub: undefined,
      ledger: [units('welcome_analysis', '2026-03-01', 1)],
      usage: { welcome_available: false, full: { used: 0, cap: 0 }, lite: { used: 0, cap: 5 } },
    },
    {
      name: 'Free, 4 Lite this month and 5 last month',
      sub: undefined,
      ledger: [units('lite_analysis', '2026-10-01', 4), units('lite_analysis', '2026-09-01', 5)],
      usage: { welcome_available: true, full: { used: 0, cap: 0 }, lite: { used: 4, cap: 5 } },
    },
    {
      name: 'Plus, this period only, extra instruments count as full',
      sub: subscription(),
      ledger: [
        units('full_analysis', '2026-10-05', 3),
        units('extra_instrument', '2026-10-05', 1),
        units('full_analysis', '2026-09-05', 15),
        units('lite_analysis', '2026-10-05', 40),
        units('welcome_analysis', '2026-08-01', 1),
      ],
      usage: {
        welcome_available: false,
        full: { used: 4, cap: 15 },
        lite: { used: 40, cap: null },
      },
    },
    {
      name: 'Free, Lite allowance used up',
      sub: undefined,
      ledger: [units('lite_analysis', '2026-10-01', 5)],
      usage: { welcome_available: true, full: { used: 0, cap: 0 }, lite: { used: 5, cap: 5 } },
    },
    {
      name: 'Plus, full allowance used up with an extra instrument',
      sub: subscription({ plan: 'paid_yearly' }),
      ledger: [
        units('full_analysis', '2026-10-05', 14),
        units('extra_instrument', '2026-10-05', 1),
      ],
      usage: {
        welcome_available: false,
        full: { used: 15, cap: 15 },
        lite: { used: 0, cap: null },
      },
    },
    {
      name: 'Plus past due keeps its allowance',
      sub: subscription({ status: 'past_due' }),
      ledger: [units('full_analysis', '2026-10-05', 2)],
      usage: { full: { used: 2, cap: 15 } },
    },
    {
      name: 'Plus that ended: back to Free, Free usage this month counts',
      sub: subscription({ currentPeriodEnd: new Date('2026-10-10T00:00:00Z') }),
      ledger: [units('full_analysis', '2026-10-05', 2), units('lite_analysis', '2026-10-01', 1)],
      usage: { welcome_available: true, full: { used: 0, cap: 0 }, lite: { used: 1, cap: 5 } },
    },
  ])('$name', ({ sub, ledger, usage }) => {
    const result = ent(sub, ledger as LedgerUnits[])
    expect(result.usage).toMatchObject(usage)
  })

  it('bounds Plus Lite by fair use while showing it as unlimited', () => {
    expect(ent(subscription(), []).liteCap).toBe(200)
    expect(ent(undefined, []).liteCap).toBe(5)
  })

  it('reports reset dates of the period', () => {
    expect(ent(undefined, []).usage.lite.resets_at).toBe('2026-11-01T00:00:00.000Z')
    expect(ent(subscription(), []).usage.full.resets_at).toBe('2026-11-05T00:00:00.000Z')
  })
})

describe('admit', () => {
  // The cap itself is applied by the run's transaction (packages/db reservations, tests/billing).
  it.each([
    [
      'Free full → the Welcome analysis, lifetime',
      undefined,
      'full',
      'welcome',
      PRIORITY.free,
      {
        kind: 'welcome_analysis',
        periodStart: '2026-10-01',
        counts: ['welcome_analysis'],
        lifetime: true,
        cap: 1,
      },
      { type: 'welcome', resets_at: null, upgrade_available: true },
    ],
    [
      'Free lite → 5 this month',
      undefined,
      'lite',
      'lite',
      PRIORITY.free,
      {
        kind: 'lite_analysis',
        periodStart: '2026-10-01',
        counts: ['lite_analysis'],
        cap: 5,
      },
      { type: 'lite', resets_at: '2026-11-01T00:00:00.000Z', upgrade_available: true },
    ],
    [
      'Plus full → 15 this period, extra instruments included',
      subscription(),
      'full',
      'full',
      PRIORITY.paid,
      {
        kind: 'full_analysis',
        periodStart: '2026-10-05',
        counts: ['full_analysis', 'extra_instrument'],
        cap: 15,
      },
      { type: 'full', resets_at: '2026-11-05T00:00:00.000Z', upgrade_available: false },
    ],
    [
      'Plus lite → fair use 200 this period',
      subscription({ plan: 'paid_yearly' }),
      'lite',
      'lite',
      PRIORITY.paid,
      {
        kind: 'lite_analysis',
        periodStart: '2026-10-05',
        counts: ['lite_analysis'],
        cap: 200,
      },
      { type: 'lite', resets_at: '2026-11-05T00:00:00.000Z', upgrade_available: false },
    ],
  ] as const)('%s', (_, sub, type, kind, priority, charge, exhausted) => {
    expect(admit(ent(sub, []), type, DEFAULT_LIMITS)).toEqual({ kind, priority, charge, exhausted })
  })

  it('follows remote limits', () => {
    const limits = { ...DEFAULT_LIMITS, freeLitePerPeriod: 3, plusFullPerPeriod: 20 }
    expect(admit(ent(undefined, [], limits), 'lite', limits).charge?.cap).toBe(3)
    expect(admit(ent(subscription(), [], limits), 'full', limits).charge?.cap).toBe(20)
  })

  it('never charges a re-run after a model upgrade', () => {
    const used = ent(undefined, [units('welcome_analysis', '2026-01-01', 1)])
    expect(admit(used, 'full', DEFAULT_LIMITS, { charged: false })).toMatchObject({
      kind: 'welcome',
      charge: undefined,
    })
  })
})
