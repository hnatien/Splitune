import type { BillingPlansOutput } from '@splitune/contracts'
import { Link, useNavigate } from '@tanstack/react-router'
import { CheckIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useId, useState } from 'react'
import type { z } from 'zod'
import { analytics } from '@/lib/analytics'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/ui/button'
import { Stat } from '@/ui/stat'
import { Status } from '@/ui/status'
import { Banner, InlineError } from '@/ui/status-message'
import { checkoutUrl, DEFAULT_PLAN, type PaidPlanName, PlanChoice } from './plans'

// Pricing (27 §3.2; 23 §3 and §5; s47 direction §1): the demo-mode line, "Every practice tool is
// free" with one sentence under it, then Free and Plus compared as two hairline rows, not boxed
// cards: what the plan is and what it gives, what it costs (Plus as Monthly and Yearly choice rows,
// neither emphasised, monthly chosen, the price from the provider, the chosen row marked by the
// ink edge and a check), and its action. Get Plus is the page's one filled control. Then the
// Compare table. No countdowns, no "most popular" badge, never a card field (25 §2). Honesty gates
// (27 §3.1, flipped in s45): the mixer phrase of the lead (s40b), the speed ladder (s37), beat
// lights (s42) and Stand view (s43) stay out until they ship.

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
        <li key={point} className="flex gap-3 text-body">
          <CheckIcon aria-hidden strokeWidth={1.8} className="mt-0.5 size-4.5 shrink-0" />
          {point}
        </li>
      ))}
    </ul>
  )
}

/** One plan as a row: what it is and gives, what it costs, and its action. */
function PlanRow({
  title,
  lead,
  current,
  points,
  price,
  action,
}: {
  title: string
  lead: string
  current: boolean
  points: string[]
  price: React.ReactNode
  action: React.ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="grid gap-x-10 gap-y-6 border-t border-border py-8 md:grid-cols-[minmax(0,1fr)_15rem_13rem] md:py-10"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 id={id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-heading">
            {title}
            {current && <Status kind="ready">{m['billing.current_plan']()}</Status>}
          </h2>
          <p className="text-body text-muted-foreground">{lead}</p>
        </div>
        <Points points={points} />
      </div>
      <div className="flex flex-col gap-3">{price}</div>
      <div className="flex flex-col items-stretch gap-3">{action}</div>
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
    <>
      <Button variant="primary" size="lg" block loading={pending} onClick={buy}>
        {m['pricing.plus_cta']()}
      </Button>
      {failed && <InlineError title={m['billing.action_failed']()} />}
    </>
  )
}

/**
 * Pricing before the prices arrive, or when they could not be loaded: the page's title, then what
 * happened, that every practice tool is free anyway, and the ways on (try again, or the example
 * song), so a failed request never drops the visitor out of the marketing pages.
 */
export function PricingUnavailable({
  signedIn,
  failed,
  onRetry,
}: {
  signedIn: boolean
  failed: boolean
  onRetry: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-pricing px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
      <h1 className="text-display text-balance">{m['pricing.title']()}</h1>
      {failed && (
        <InlineError
          className="mt-6 max-w-2xl"
          title={m['plan.prices_failed']()}
          description={m['pricing.failed_body']()}
          actions={
            <>
              <Button variant="outline" onClick={onRetry}>
                {m['common.try_again']()}
              </Button>
              {!signedIn && (
                <Link to="/start" className={buttonVariants({ variant: 'quiet' })}>
                  {m['home.cta_example']()}
                </Link>
              )}
            </>
          }
        />
      )}
    </div>
  )
}

export function PricingPage({ me, plans }: { me: MeData | null; plans: Plans }) {
  const [plan, setPlan] = useState<PaidPlanName>(DEFAULT_PLAN)
  const onPlus = me !== null && me.plan !== 'free'

  useEffect(() => {
    if (me?.plan === 'free') analytics.track('paywall_viewed', { trigger: 'pricing' })
  }, [me?.plan])

  return (
    <div className="mx-auto flex w-full max-w-pricing flex-col px-4 pb-24 sm:px-6">
      <Banner tone="info" title={m['billing.demo']()} />
      <header className="flex max-w-2xl flex-col gap-3 pt-12 pb-10 sm:pt-16">
        <h1 className="text-display text-balance">{m['pricing.title']()}</h1>
        <p className="text-lead text-pretty text-muted-foreground">{m['pricing.lead']()}</p>
      </header>

      <PlanRow
        title={m['pricing.free_name']()}
        lead={m['pricing.free_lead']()}
        current={me !== null && !onPlus}
        points={[
          m['pricing.free_point_welcome'](),
          m['pricing.free_point_lite']({ count: String(plans.allowances.free_lite_per_month) }),
          m['pricing.free_point_tools'](),
        ]}
        price={<Stat value={m['pricing.free_price']()} label={m['pricing.free_price_note']()} />}
        action={
          me ? (
            <Link to="/library" className={buttonVariants({ size: 'lg', block: true })}>
              {m['system.go_library']()}
            </Link>
          ) : (
            <Link to="/start" className={buttonVariants({ size: 'lg', block: true })}>
              {m['home.cta_example']()}
            </Link>
          )
        }
      />
      <PlanRow
        title={m['pricing.plus_name']()}
        lead={m['pricing.plus_lead']()}
        current={onPlus}
        points={[
          m['pricing.plus_point_full']({ count: String(plans.allowances.plus_full_per_period) }),
          m['pricing.plus_point_lite'](),
          m['pricing.plus_point_extra'](),
          m['pricing.plus_point_priority'](),
        ]}
        price={<PlanChoice plans={plans.plans} value={plan} onChange={setPlan} />}
        action={
          <>
            <PlusAction me={me} plan={plan} />
            <p className="text-body-sm text-pretty text-muted-foreground">
              {m['pricing.cancel_note']()}
            </p>
          </>
        }
      />

      <section aria-labelledby="compare" className="mt-16 flex flex-col gap-4">
        <h2 id="compare" className="text-heading">
          {m['pricing.compare']()}
        </h2>
        <table className="w-full border-collapse text-left text-body-sm sm:text-body">
          <thead>
            <tr className="text-label-sm text-muted-foreground">
              <th scope="col" className="py-3 pr-3 font-medium">
                {m['pricing.feature']()}
              </th>
              <th scope="col" className="w-22 py-3 pr-3 font-medium sm:w-45">
                {m['pricing.free_name']()}
              </th>
              <th scope="col" className="w-22 py-3 font-medium sm:w-45">
                {m['pricing.plus_name']()}
              </th>
            </tr>
          </thead>
          <tbody>
            {compareRows(plans).map(([feature, free, plus]) => (
              <tr key={feature} className="border-t border-border align-top">
                <th scope="row" className="py-3.5 pr-3 font-normal">
                  {feature}
                </th>
                {[free, plus].map((value, column) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: the two plan columns are fixed
                    key={column}
                    className={cn(
                      'py-3.5 text-pretty',
                      column === 0 && 'pr-3',
                      value === m['pricing.coming_soon']() && 'text-muted-foreground',
                    )}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
