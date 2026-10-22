import type {
  DataExportState,
  Me as MeSchema,
  Subscription as SubscriptionSchema,
} from '@splitune/contracts'
import { type DataExportRow, revokeSessions, type UserProfilePatch } from '@splitune/db'
import { exportKey } from '@splitune/storage'
import type { z } from 'zod'
import { requireRecentAuth } from '../auth.ts'
import { loadEntitlements } from '../entitlements.ts'
import { apiError } from '../errors.ts'
import { evaluateFlags } from '../flags.ts'
import { type ApiDeps, authed, userRateLimit } from '../procedures.ts'

type Me = z.infer<typeof MeSchema>
type PaidPlan = z.infer<typeof SubscriptionSchema>['plan']
type ExportState = z.infer<typeof DataExportState>

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
    // Stored flags (plan limits included) plus every declared flag, evaluated (flags.ts).
    flags: {
      ...Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled])),
      ...evaluateFlags(flags),
    },
  }
}

// "Download my data" (15 §4): the latest request; a bundle past its day counts as none. A ready
// bundle's link is valid exactly as long as the bundle is kept.
async function toExportState(deps: ApiDeps, row: DataExportRow | undefined): Promise<ExportState> {
  const none = { status: 'none', requested_at: null, ready_at: null, expires_at: null, url: null }
  if (!row || row.status === 'expired') return none as ExportState
  const now = Date.now()
  const expiresAt = row.expiresAt?.getTime() ?? 0
  if (row.status === 'ready' && expiresAt <= now) return none as ExportState
  return {
    status: row.status,
    requested_at: row.requestedAt.toISOString(),
    ready_at: row.readyAt ? row.readyAt.toISOString() : null,
    expires_at: row.expiresAt ? row.expiresAt.toISOString() : null,
    url:
      row.status === 'ready'
        ? await deps.storage.presignGet(row.objectKey, {
            expiresIn: Math.max(1, Math.floor((expiresAt - now) / 1000)),
          })
        : null,
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

  export: authed.use(userRateLimit('exports')).me.export.handler(async ({ context }) => {
    const { deps, userId } = context
    const row = await deps.repos.privacy.requestExport(userId, (id) => exportKey(userId, id))
    return toExportState(deps, row)
  }),

  exportState: authed.me.exportState.handler(async ({ context }) =>
    toExportState(context.deps, await context.deps.repos.privacy.latestExport(context.userId)),
  ),

  // Deleting the account (15 §3) needs a sign-in within the last 10 minutes; then every session
  // ends at once and the node worker removes objects and rows.
  delete: authed.me.delete.handler(async ({ context }) => {
    const { deps, userId, session } = context
    if (!session) throw apiError('unauthenticated')
    requireRecentAuth(session)
    const at = await deps.repos.privacy.requestDeletion(userId)
    if (!at) throw apiError('unauthenticated')
    await revokeSessions(deps.db, userId)
    context.log.info({ user_hash: deps.analyticsHash(userId) }, 'account deletion requested')
    return { purge_after: at.toISOString() }
  }),
}
