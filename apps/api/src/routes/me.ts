import type { Me as MeSchema, Subscription as SubscriptionSchema } from '@splitune/contracts'
import type { UserProfilePatch } from '@splitune/db'
import type { z } from 'zod'
import { loadEntitlements } from '../entitlements.ts'
import { apiError } from '../errors.ts'
import { type ApiDeps, authed } from '../procedures.ts'

type Me = z.infer<typeof MeSchema>
type PaidPlan = z.infer<typeof SubscriptionSchema>['plan']

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null)

async function readMe(deps: ApiDeps, userId: string): Promise<Me> {
  // Renewals or expiry due on the billing clock land before the plan is read.
  await deps.billing.settle({ userId })
  const [profile, loaded] = await Promise.all([
    deps.repos.users.profile(userId),
    loadEntitlements(deps, userId, deps.billing.clock.now()),
  ])
  // The session outlived its user (account deleted): treat as signed out.
  if (!profile || !loaded) throw apiError('unauthenticated')
  const { user, subscription, flags } = profile
  const { ent } = loaded
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
    plan: ent.plan,
    subscription:
      subscription && subscription.plan !== 'free'
        ? {
            plan: subscription.plan as PaidPlan,
            status: subscription.status,
            current_period_end: iso(subscription.currentPeriodEnd),
            cancel_at_period_end: subscription.cancelAtPeriodEnd,
          }
        : null,
    usage: ent.usage,
    entitlements: ent.keys,
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
