import type { Me as MeSchema, Subscription as SubscriptionSchema } from '@splitune/contracts'
import type { UserProfilePatch } from '@splitune/db'
import type { z } from 'zod'
import { ALLOWANCES, entitlementsFor, planOf, usagePeriod } from '../entitlements.ts'
import { apiError } from '../errors.ts'
import { type ApiDeps, authed } from '../procedures.ts'

type Me = z.infer<typeof MeSchema>
type PaidPlan = z.infer<typeof SubscriptionSchema>['plan']

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null)

async function readMe(deps: ApiDeps, userId: string, now = new Date()): Promise<Me> {
  const profile = await deps.repos.users.profile(userId)
  // The session outlived its user (account deleted): treat as signed out.
  if (!profile) throw apiError('unauthenticated')
  const { user, subscription, flags } = profile
  const plan = planOf(subscription, now)
  const period = usagePeriod(plan, subscription, now)
  const allowance = plan === 'free' ? ALLOWANCES.free : ALLOWANCES.paid
  const [current, lifetime] = await Promise.all([
    deps.repos.usage.totals(
      userId,
      ['full_analysis', 'lite_analysis', 'extra_instrument'],
      period.start,
    ),
    deps.repos.usage.totals(userId, ['welcome_analysis']),
  ])
  const resetsAt = iso(period.resetsAt)
  return {
    id: user.id,
    email: user.email,
    // Splitune's own display name wins; the OAuth profile name is the fallback.
    display_name: user.displayName ?? (user.name.trim() || null),
    primary_instrument: user.primaryInstrument,
    level: user.level,
    handedness: user.handedness,
    training_opt_in: user.trainingOptIn,
    marketing_opt_in: user.marketingOptIn,
    plan,
    subscription:
      subscription && subscription.plan !== 'free'
        ? {
            plan: subscription.plan as PaidPlan,
            status: subscription.status,
            current_period_end: iso(subscription.currentPeriodEnd),
            cancel_at_period_end: subscription.cancelAtPeriodEnd,
          }
        : null,
    usage: {
      welcome_available: (lifetime.welcome_analysis ?? 0) < allowance.welcome,
      // An extra instrument on a song counts as one full analysis (14 §2).
      full: {
        used: (current.full_analysis ?? 0) + (current.extra_instrument ?? 0),
        cap: allowance.full,
        resets_at: resetsAt,
      },
      lite: { used: current.lite_analysis ?? 0, cap: allowance.lite, resets_at: resetsAt },
    },
    entitlements: entitlementsFor(plan),
    flags: Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled])),
  }
}

export const me = {
  get: authed.me.get.handler(({ context }) => readMe(context.deps, context.userId)),

  update: authed.me.update.handler(async ({ context, input }) => {
    const patch: UserProfilePatch = {}
    if (input.display_name !== undefined) patch.displayName = input.display_name
    if (input.primary_instrument !== undefined) patch.primaryInstrument = input.primary_instrument
    if (input.level !== undefined) patch.level = input.level
    if (input.handedness !== undefined) patch.handedness = input.handedness
    if (input.training_opt_in !== undefined) patch.trainingOptIn = input.training_opt_in
    if (input.marketing_opt_in !== undefined) patch.marketingOptIn = input.marketing_opt_in
    if (Object.keys(patch).length > 0) {
      const updated = await context.deps.repos.users.updateProfile(context.userId, patch)
      if (!updated) throw apiError('unauthenticated')
    }
    return readMe(context.deps, context.userId)
  }),
}
