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
import { Card } from '@/ui/card'
import { InlineError } from '@/ui/status-message'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { checkoutUrl, DEFAULT_PLAN, type PaidPlanName, type Plan, planPrice } from './plans'
import { formatPrice } from './price'

// Pricing (27 §3.2, `Pricing.dc.html`; 23 §3 and §5): the demo-mode banner, "Every practice tool is
// free", Free and Plus cards (Monthly / Yearly segmented with neither emphasised, monthly chosen,
// the price from the provider), and the Compare table. No countdowns, no "most popular" badge,
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
    <ul className="flex flex-col gap-2.5">
      {points.map((point) => (
        <li key={point} className="flex gap-2.5 text-base">
          <CheckIcon aria-hidden strokeWidth={1.8} className="size-5 shrink-0 text-foreground" />
          {point}
        </li>
      ))}
    </ul>
  )
}

function PlanCard({
  title,
  lead,
  current,
  aside,
  children,
}: {
  title: string
  lead: string
  current: boolean
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <Card role="region" aria-labelledby={id} className="gap-4.5 p-7">
      <div className="flex flex-wrap items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={id} className="flex flex-wrap items-center gap-2 text-xl">
            {title}
            {current && (
              <Badge className="forced-colors:bg-card forced-colors:inset-ring forced-colors:inset-ring-border">
                {m['billing.current_plan']()}
              </Badge>
            )}
          </h2>
          <p className="text-base text-muted-foreground">{lead}</p>
        </div>
        {aside}
      </div>
      {children}
    </Card>
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
      <Link
        to="/settings/account"
        hash="plan"
        className={buttonVariants({ size: 'lg', block: true })}
      >
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
      <span className="font-mono text-3xl tabular-nums">
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
        className="flex items-center justify-center gap-2 bg-accent px-4 py-2 text-center text-md text-foreground forced-colors:border-b forced-colors:bg-card"
      >
        <InfoIcon aria-hidden strokeWidth={1.8} className="size-4 shrink-0 text-info" />
        {m['billing.demo']()}
      </p>
      <div className="mx-auto flex w-full max-w-pricing flex-col gap-10 px-4 pt-10 pb-18 sm:px-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-5xl text-balance">{m['pricing.title']()}</h1>
          <p className="max-w-2xl text-lead text-pretty text-muted-foreground">
            {m['pricing.lead']()}
          </p>
        </header>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(23.75rem,100%),1fr))] gap-5">
          <PlanCard
            title={m['pricing.free_name']()}
            lead={m['pricing.free_lead']()}
            current={me !== null && !onPlus}
          >
            <p className="font-mono text-3xl">{m['pricing.free_price']()}</p>
            <Points
              points={[
                m['pricing.free_point_welcome'](),
                m['pricing.free_point_lite']({
                  count: String(plans.allowances.free_lite_per_month),
                }),
                m['pricing.free_point_tools'](),
              ]}
            />
            {!me && (
              <Link
                to="/start"
                className={cn(buttonVariants({ size: 'lg', block: true }), 'mt-auto')}
              >
                {m['home.cta_example']()}
              </Link>
            )}
          </PlanCard>
          <PlanCard
            title={m['pricing.plus_name']()}
            lead={m['pricing.plus_lead']()}
            current={onPlus}
            aside={
              <div className="flex flex-col items-end">
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
            }
          >
            <PlusPrice chosen={chosen} other={other} />
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
            <div className="mt-auto flex flex-col gap-3">
              <PlusAction me={me} plan={plan} />
              <p className="text-center text-sm text-faint-foreground">
                {m['pricing.cancel_note']()}
              </p>
            </div>
          </PlanCard>
        </div>

        <section aria-labelledby="compare" className="flex flex-col gap-3.5">
          <h2 id="compare" className="text-lg">
            {m['pricing.compare']()}
          </h2>
          <table className="w-full border-collapse text-left text-base">
            <thead>
              <tr className="text-sm text-faint-foreground">
                <th scope="col" className="py-2.5 pr-4 font-semibold">
                  {m['pricing.feature']()}
                </th>
                <th scope="col" className="w-24 py-2.5 pr-3 font-semibold sm:w-45">
                  {m['pricing.free_name']()}
                </th>
                <th scope="col" className="w-24 py-2.5 font-semibold sm:w-45">
                  {m['pricing.plus_name']()}
                </th>
              </tr>
            </thead>
            <tbody>
              {compareRows(plans).map(([feature, free, plus]) => (
                <tr key={feature} className="border-t border-border align-top">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    {feature}
                  </th>
                  <td className="py-3 pr-3 text-muted-foreground">{free}</td>
                  <td className="py-3">{plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
