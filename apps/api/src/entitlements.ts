import type { AnalysisCapDetails, EntitlementKey, Plan, Usage } from '@splitune/contracts'
import type { Repositories, Subscription, UsageCharge, UsageKind } from '@splitune/db'
import type { z } from 'zod'

// Plans and allowances of 23-plans-free-and-paid.md and 14-auth-billing-and-entitlements.md §2:
// `entitlements()` is a pure function of the cached subscription, the user's usage_ledger, the
// limits (config + remote flags) and the clock. Admission turns it into a usage_ledger reservation
// that the analysis' own transaction makes (packages/db `UsageCharge`).

type PlanName = z.infer<typeof Plan>
type Key = z.infer<typeof EntitlementKey>
type CapDetails = z.infer<typeof AnalysisCapDetails>

// Allowances per period (23 §2). Remote flags override them without a deploy (23 §6).
export interface Limits {
  freeLitePerPeriod: number
  plusFullPerPeriod: number
  // Plus Lite is unlimited for the learner; fair use bounds abuse.
  plusLiteFairUse: number
  welcomeLifetime: number
}

export const DEFAULT_LIMITS: Limits = {
  freeLitePerPeriod: 5,
  plusFullPerPeriod: 15,
  plusLiteFairUse: 200,
  welcomeLifetime: 1,
}

const LIMIT_FLAGS: Record<string, keyof Limits> = {
  'plan.free.lite_per_month': 'freeLitePerPeriod',
  'plan.plus.full_per_month': 'plusFullPerPeriod',
  'plan.plus.lite_fair_use': 'plusLiteFairUse',
}

export interface Flag {
  key: string
  enabled: boolean
  value: unknown
}

// An enabled flag whose value is a non-negative integer replaces the default.
export function limitsFrom(flags: readonly Flag[]): Limits {
  const limits = { ...DEFAULT_LIMITS }
  for (const flag of flags) {
    const name = LIMIT_FLAGS[flag.key]
    if (name && flag.enabled && Number.isSafeInteger(flag.value) && (flag.value as number) >= 0) {
      limits[name] = flag.value as number
    }
  }
  return limits
}

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

// Queue priority (lower runs first): Plus has priority processing (23 §3).
export const PRIORITY = { free: 100, paid: 50 } as const

export interface LedgerUnits {
  kind: UsageKind
  periodStart: string
  units: number
}

export interface Entitlements {
  plan: PlanName
  keys: Key[]
  period: UsagePeriod
  usage: z.infer<typeof Usage>
  // Enforced at admission; Plus Lite shows as unlimited (cap null) in `usage`.
  liteCap: number
}

const FULL_KINDS: readonly UsageKind[] = ['full_analysis', 'extra_instrument']

export function entitlements(
  input: { subscription: Subscription | undefined; ledger: readonly LedgerUnits[]; limits: Limits },
  now: Date,
): Entitlements {
  const { subscription, ledger, limits } = input
  const plan = planOf(subscription, now)
  const period = usagePeriod(plan, subscription, now)
  const used = (kinds: readonly UsageKind[], lifetime = false) =>
    ledger
      .filter((row) => kinds.includes(row.kind) && (lifetime || row.periodStart === period.start))
      .reduce((sum, row) => sum + row.units, 0)
  const resetsAt = period.resetsAt ? period.resetsAt.toISOString() : null
  const free = plan === 'free'
  const liteCap = free ? limits.freeLitePerPeriod : limits.plusLiteFairUse
  return {
    plan,
    keys: entitlementsFor(plan),
    period,
    liteCap,
    usage: {
      // The Welcome analysis is Free's: once used, it never comes back (23 §2).
      welcome_available: free && used(['welcome_analysis'], true) < limits.welcomeLifetime,
      // An extra instrument on a song counts as one full analysis (14 §2).
      full: {
        used: used(FULL_KINDS),
        cap: free ? 0 : limits.plusFullPerPeriod,
        resets_at: resetsAt,
      },
      lite: { used: used(['lite_analysis']), cap: free ? liteCap : null, resets_at: resetsAt },
    },
  }
}

export interface Admission {
  // analyses.analysis_type: a Free user's full request is their Welcome analysis (23 §2).
  kind: 'welcome' | 'full' | 'lite'
  priority: number
  // The reservation the run makes; none for a re-run after a Splitune model upgrade.
  charge: UsageCharge | undefined
  // The 402 details when no unit is left. The count happens in the run's own transaction, under a
  // lock (concurrent requests), and only for a new run: a repeated request for an existing run is
  // answered with that run whatever is left.
  exhausted: CapDetails
}

// What a new run of `type` uses.
export function admit(
  ent: Entitlements,
  type: 'full' | 'lite',
  limits: Limits,
  { charged = true }: { charged?: boolean } = {},
): Admission {
  const priority = ent.keys.includes('processing.priority') ? PRIORITY.paid : PRIORITY.free
  const free = ent.plan === 'free'
  const resetsAt = ent.period.resetsAt ? ent.period.resetsAt.toISOString() : null
  const periodStart = ent.period.start
  let kind: Admission['kind']
  let charge: UsageCharge
  if (type === 'lite') {
    kind = 'lite'
    charge = { kind: 'lite_analysis', periodStart, counts: ['lite_analysis'], cap: ent.liteCap }
  } else if (!free) {
    kind = 'full'
    charge = {
      kind: 'full_analysis',
      periodStart,
      counts: FULL_KINDS,
      cap: limits.plusFullPerPeriod,
    }
  } else {
    kind = 'welcome'
    charge = {
      kind: 'welcome_analysis',
      periodStart,
      counts: ['welcome_analysis'],
      lifetime: true,
      cap: limits.welcomeLifetime,
    }
  }
  return {
    kind,
    priority,
    charge: charged ? charge : undefined,
    exhausted: refusal(kind, free, resetsAt),
  }
}

function refusal(kind: Admission['kind'], free: boolean, resetsAt: string | null): CapDetails {
  // The Welcome analysis never resets; Plus is the way to more full analyses.
  return { type: kind, resets_at: kind === 'welcome' ? null : resetsAt, upgrade_available: free }
}

// Reads what entitlements() needs for a user.
export async function loadEntitlements(
  deps: { repos: Repositories },
  userId: string,
  now: Date,
): Promise<{ ent: Entitlements; limits: Limits } | undefined> {
  const [profile, ledger] = await Promise.all([
    deps.repos.users.profile(userId),
    deps.repos.usage.summary(userId),
  ])
  if (!profile) return undefined
  const limits = limitsFrom(profile.flags)
  return {
    ent: entitlements({ subscription: profile.subscription, ledger, limits }, now),
    limits,
  }
}
