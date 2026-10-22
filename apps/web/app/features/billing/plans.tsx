import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import {
  type BillingPlan,
  billingContract,
  type MockPortalAction,
  type PaidPlan,
  type PaywallTrigger,
} from '@splitune/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import type { z } from 'zod'
import { analytics } from '@/lib/analytics'
import { clientFor } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { reloadMe } from '@/lib/reload-me'
import type { MeData } from '@/lib/session'
import { RadioCard, RadioCardGroup } from '@/ui/radio-card'
import { formatPrice } from './price'

// Plans as the provider prices them (14 §3: never hard-coded in the client), and the way into
// checkout from every point of action (23 §5). Billing has its own client (contracts
// `billingContract`), loaded by the pricing and billing pages only.

export const billingClient = clientFor(billingContract)
export const billingOrpc = createTanstackQueryUtils(billingClient)
export const plansQuery = billingOrpc.billing.plans.queryOptions({ staleTime: 10 * 60_000 })

export type PaidPlanName = z.infer<typeof PaidPlan>
export type Plan = z.infer<typeof BillingPlan>
export type Trigger = z.infer<typeof PaywallTrigger>

// No pre-selected annual plan (23 §5): monthly is where every choice starts.
export const DEFAULT_PLAN: PaidPlanName = 'paid_monthly'

export const planName = (plan: PaidPlanName) =>
  plan === 'paid_yearly' ? m['billing.plan_yearly']() : m['billing.plan_monthly']()

export const planPrice = (plan: Plan) => {
  const price = formatPrice(plan.price_minor, plan.currency)
  return plan.interval === 'year'
    ? m['plan.price_year']({ price })
    : m['plan.price_month']({ price })
}

/** The mock checkout link for `plan`; a cancelled checkout comes back to `returnPath`. */
export async function checkoutUrl(plan: PaidPlanName, trigger: Trigger, returnPath: string) {
  analytics.track('upgrade_clicked', { trigger, plan })
  const { url } = await billingClient.billing.checkout({ plan, return_path: returnPath })
  return url
}

/** Reloads the plan and allowances everywhere (route context and queries) after a change. */
export function useRefreshMe() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async () => {
    await reloadMe(queryClient)
    await router.invalidate()
  }
}

export type PortalAction = z.infer<typeof MockPortalAction>

/** The mock portal's session from its link (the portal page and one-tap cancel in Settings). */
export const sessionOf = (url: string) =>
  new URL(url, 'http://splitune.internal').searchParams.get('session') ?? ''

/** One portal action without visiting the portal: Settings' one-tap cancel and resume (14 §4.4). */
export async function portalAction(action: PortalAction) {
  const { url } = await billingClient.billing.portal()
  await billingClient.billing.mockPortal({ session: sessionOf(url), action })
}

/** "Renews on 5 Nov" / "Ends on 5 Nov" for a live Plus subscription. */
export function periodLine(me: MeData): string | undefined {
  const subscription = me.subscription
  if (me.plan === 'free' || !subscription?.current_period_end) return undefined
  const date = formatDate(new Date(subscription.current_period_end))
  return subscription.cancel_at_period_end
    ? m['billing.ends_on']({ date })
    : m['billing.renews_on']({ date })
}

/** Monthly and yearly as equal choice cards, monthly chosen (23 §5: no pre-selected annual). */
export function PlanChoice({
  plans,
  value,
  onChange,
  className,
}: {
  plans: Plan[]
  value: PaidPlanName
  onChange: (plan: PaidPlanName) => void
  className?: string
}) {
  return (
    <RadioCardGroup
      aria-label={m['plan.interval']()}
      value={value}
      onValueChange={(next) => onChange(next as PaidPlanName)}
      className={className}
    >
      {plans.map((p) => (
        <RadioCard
          key={p.plan}
          value={p.plan}
          title={p.interval === 'year' ? m['plan.yearly']() : m['plan.monthly']()}
          description={planPrice(p)}
        />
      ))}
    </RadioCardGroup>
  )
}
