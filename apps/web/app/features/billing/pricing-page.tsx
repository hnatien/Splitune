import type { BillingPlansOutput } from '@splitune/contracts'
import { Link, useNavigate } from '@tanstack/react-router'
import { CheckIcon, InfoIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useId, useState } from 'react'
import type { z } from 'zod'
import { analytics } from '@/lib/analytics'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { Button, buttonVariants } from '@/ui/button'
import { InlineError } from '@/ui/status-message'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { checkoutUrl, DEFAULT_PLAN, type PaidPlanName, type Plan, planPrice } from './plans'
import { formatPrice } from './price'

// Pricing (27 §3.2; 23 §3 and §5): the demo-mode line, "Every practice tool is free" centred with
// one sentence under it, the Monthly / Yearly segmented control (neither emphasised, monthly chosen,
// the price from the provider), then Free and Plus as hairline columns: name, one line, price, the
// action, a rule and the checklist. Then the Compare table. No countdowns, no "most popular" badge,
// never a card field (25 §2). Honesty gates (27 §3.1, flipped in s45): the mixer phrase of the lead
// (s40b), the speed ladder (s37), beat lights (s42) and Stand view (s43) stay out until they ship.

type Plans = z.infer<typeof BillingPlansOutput>

function compareRows(plans: Plans): [string, string, string][] {
  const { allowances } = plans
  const included = m['pricing.included']()
  const soon = m['pricing.coming_soon']()
  return [
    [m['pricing.row_loops'](), included, included],
    [m['pricing.row_slow'](), included, included],
    [m['pricing.row_count_in'](), included, included],
    [m['pricing.row_tools'](), included, included],
    [m['pricing.row_keys'](), included, included],
    [
      m['pricing.row_full'](),
      m['pricing.welcome_one'](),
      m['pricing.per_month']({ count: String(allowances.plus_full_per_period) }),
    ],
    [
      m['pricing.row_lite'](),
      m['pricing.per_month']({ count: String(allowances.free_lite_per_month) }),
      m['pricing.no_limit'](),
    ],
    [m['pricing.row_export'](), soon, soon],
  ]
}

function Points({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-3.5 border-t border-border pt-6">
      {points.map((point) => (
        <li key={point} className="flex gap-3 text-md">
          <CheckIcon aria-hidden strokeWidth={1.5} className="size-5 shrink-0 text-foreground" />
          {point}
        </li>
      ))}
    </ul>
  )
}

function PlanColumn({
  title,
  lead,
  current,
  children,
}: {
  title: string
  lead: string
  current: boolean
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-6 rounded-xl border border-border p-6 sm:p-8"
    >
      <div className="flex flex-col gap-2">
        <h2 id={id} className="flex flex-wrap items-center gap-3 text-2xl">
          {title}
          {current && (
            <Badge className="forced-colors:bg-card forced-colors:inset-ring forced-colors:inset-ring-border">
              {m['billing.current_plan']()}
            </Badge>
          )}
        </h2>
        <p className="text-base text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  )
}
function PlusAction({ me, plan }: { me: MeData | null; plan: PaidPlanName }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!me) {
    return (
      <Link
        to="/auth/sign-in"
        search={{ next: '/pricing' }}
        className={buttonVariants({ variant: 'primary', size: 'lg', block: true })}
      >
        {m['pricing.plus_cta']()}
      </Link>
    )
  }
  if (me.plan !== 'free') {
    return (
      <Link to="/settings/plan" className={buttonVariants({ size: 'lg', block: true })}>
        {m['pricing.manage']()}
      </Link>
    )
  }
  const buy = async () => {
    setPending(true)
    setFailed(false)
    try {
      await navigate({ href: await checkoutUrl(plan, 'pricing', '/pricing') })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="flex w-full flex-col gap-3">
      <Button variant="primary" size="lg" block loading={pending} onClick={buy}>
        {m['pricing.plus_cta']()}
      </Button>
      {failed && <InlineError title={m['billing.action_failed']()} />}
    </div>
  )
}

/** "$9.99 a month · or $79.99 a year": the chosen interval large, the other beside it. */
function PlusPrice({ chosen, other }: { chosen: Plan | undefined; other: Plan | undefined }) {
  if (!chosen) return null
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-4xl tabular-nums">
        {formatPrice(chosen.price_minor, chosen.currency)}
      </span>{' '}
      <span className="text-base text-muted-foreground">
        {chosen.interval === 'year' ? m['pricing.unit_year']() : m['pricing.unit_month']()}
      </span>
      {other && (
        <>
          {' '}
          <span className="text-sm text-faint-foreground">
            {m['pricing.or_price']({ price: planPrice(other) })}
          </span>
        </>
      )}
    </p>
  )
}

export function PricingPage({ me, plans }: { me: MeData | null; plans: Plans }) {
  const [plan, setPlan] = useState<PaidPlanName>(DEFAULT_PLAN)
  const onPlus = me !== null && me.plan !== 'free'
  const chosen = plans.plans.find((p) => p.plan === plan)
  const other = plans.plans.find((p) => p.plan !== plan)
  const periodId = useId()

  useEffect(() => {
    if (me?.plan === 'free') analytics.track('paywall_viewed', { trigger: 'pricing' })
  }, [me?.plan])

  return (
    <div className="flex flex-col">
      <p
        role="status"
        className="flex items-center justify-center gap-2 border-b border-border bg-muted px-4 py-2.5 text-center text-md text-foreground forced-colors:bg-card"
      >
        <InfoIcon aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
        {m['billing.demo']()}
      </p>
      <div className="mx-auto flex w-full max-w-pricing flex-col px-4 pt-16 pb-24 sm:px-6 sm:pt-20">
        <header className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-5xl text-balance max-sm:text-4xl">{m['pricing.title']()}</h1>
          <p className="max-w-2xl text-lead text-pretty text-muted-foreground">
            {m['pricing.lead']()}
          </p>
        </header>

        <div className="mt-10 flex justify-center">
          <span id={periodId} className="sr-only">
            {m['pricing.period']()}
          </span>
          <ToggleGroup
            aria-labelledby={periodId}
            value={[plan]}
            onValueChange={(next) => {
              const picked = next[0]
              if (picked) setPlan(picked as PaidPlanName)
            }}
          >
            {plans.plans.map((p) => (
              <ToggleGroupItem key={p.plan} value={p.plan}>
                {p.interval === 'year' ? m['plan.yearly']() : m['plan.monthly']()}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <PlanColumn
            title={m['pricing.free_name']()}
            lead={m['pricing.free_lead']()}
            current={me !== null && !onPlus}
          >
            <p className="text-4xl">{m['pricing.free_price']()}</p>
            {!me && (
              <Link to="/start" className={buttonVariants({ size: 'lg', block: true })}>
                {m['home.cta_example']()}
              </Link>
            )}
            <Points
              points={[
                m['pricing.free_point_welcome'](),
                m['pricing.free_point_lite']({
                  count: String(plans.allowances.free_lite_per_month),
                }),
                m['pricing.free_point_tools'](),
              ]}
            />
          </PlanColumn>
          <PlanColumn
            title={m['pricing.plus_name']()}
            lead={m['pricing.plus_lead']()}
            current={onPlus}
          >
            <PlusPrice chosen={chosen} other={other} />
            <PlusAction me={me} plan={plan} />
            <Points
              points={[
                m['pricing.plus_point_full']({
                  count: String(plans.allowances.plus_full_per_period),
                }),
                m['pricing.plus_point_lite'](),
                m['pricing.plus_point_extra'](),
                m['pricing.plus_point_priority'](),
              ]}
            />
            <p className="mt-auto text-sm text-faint-foreground">{m['pricing.cancel_note']()}</p>
          </PlanColumn>
        </div>

        <section aria-labelledby="compare" className="mt-24 flex flex-col gap-6">
          <h2 id="compare" className="text-xl">
            {m['pricing.compare']()}
          </h2>
          <table className="w-full border-collapse text-left text-base">
            <thead>
              <tr className="text-sm text-faint-foreground">
                <th scope="col" className="py-3 pr-4 font-medium">
                  {m['pricing.feature']()}
                </th>
                <th scope="col" className="w-24 py-3 pr-3 font-medium sm:w-45">
                  {m['pricing.free_name']()}
                </th>
                <th scope="col" className="w-24 py-3 font-medium sm:w-45">
                  {m['pricing.plus_name']()}
                </th>
              </tr>
            </thead>
            <tbody>
              {compareRows(plans).map(([feature, free, plus]) => (
                <tr key={feature} className="border-t border-border align-top">
                  <th scope="row" className="py-4 pr-4 font-normal">
                    {feature}
                  </th>
                  <td
                    className={cn(
                      'py-4 pr-3',
                      free === m['pricing.coming_soon']() && 'text-muted-foreground',
                    )}
                  >
                    {free}
                  </td>
                  <td
                    className={cn(
                      'py-4',
                      plus === m['pricing.coming_soon']() && 'text-muted-foreground',
                    )}
                  >
                    {plus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
