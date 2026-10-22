import type { BillingPlansOutput } from '@splitune/contracts'
import { Link, useNavigate } from '@tanstack/react-router'
import { CheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { z } from 'zod'
import { analytics } from '@/lib/analytics'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { Button, buttonVariants } from '@/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/card'
import { Banner, InlineError } from '@/ui/status-message'
import { checkoutUrl, DEFAULT_PLAN, type PaidPlanName, PlanChoice } from './plans'

// Pricing (27 §3.2, 23 §3 and §5): Free and Plus side by side, the feature matrix with practice
// first (all of it free), monthly and yearly prices side by side as the same choice cards as the
// upgrade sheet (monthly chosen, no emphasis on yearly), "Cancel anytime in one tap", the
// demo-mode banner. No countdowns, no "most popular" badge.

type Plans = z.infer<typeof BillingPlansOutput>
type Cell = boolean | string

function MatrixCell({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <>
        <CheckIcon aria-hidden className="size-5 text-primary" />
        <span className="sr-only">{m['pricing.included']()}</span>
      </>
    )
  }
  if (value === false) {
    return (
      <>
        <span aria-hidden className="text-muted-foreground">
          —
        </span>
        <span className="sr-only">{m['pricing.not_included']()}</span>
      </>
    )
  }
  return <span>{value}</span>
}

function matrix(plans: Plans): { group: string; rows: [string, Cell, Cell][] }[] {
  const { allowances } = plans
  const perMonth = (count: number) => m['pricing.per_month']({ count: String(count) })
  const soon = m['pricing.coming_soon']()
  return [
    {
      group: m['pricing.group_practice'](),
      rows: [
        [m['pricing.f_loops'](), true, true],
        [m['pricing.f_slow'](), true, true],
        [m['pricing.f_count_in'](), true, true],
        [m['pricing.f_mixer'](), true, true],
        [m['pricing.f_notation'](), true, true],
        [m['pricing.f_level'](), true, true],
        [m['pricing.f_pedal'](), true, true],
        [m['pricing.f_examples'](), true, true],
        [m['pricing.f_library'](), true, true],
      ],
    },
    {
      group: m['pricing.group_analyses'](),
      rows: [
        [m['pricing.f_welcome'](), m['pricing.once'](), false],
        [m['pricing.f_full'](), false, perMonth(allowances.plus_full_per_period)],
        [m['pricing.f_lite'](), perMonth(allowances.free_lite_per_month), m['pricing.fair_use']()],
        [m['pricing.f_extra'](), false, true],
        [m['pricing.f_priority'](), false, true],
      ],
    },
    {
      group: m['pricing.group_depth'](),
      rows: [
        [m['pricing.f_mic'](), false, soon],
        [m['pricing.f_offline'](), false, soon],
        [m['pricing.f_export'](), false, soon],
      ],
    },
  ]
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
        className={cn(buttonVariants({ variant: 'primary' }), 'w-full')}
      >
        {m['pricing.plus_cta']()}
      </Link>
    )
  }
  if (me.plan !== 'free') {
    return (
      <Link to="/settings/billing" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
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
      <Button variant="primary" className="w-full" loading={pending} onClick={buy}>
        {m['pricing.plus_cta']()}
      </Button>
      {failed && <InlineError title={m['billing.action_failed']()} />}
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
    <div className="flex flex-col">
      <Banner tone="info" title={m['billing.demo']()} />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl">{m['pricing.title']()}</h1>
          <p className="text-lg text-muted-foreground">{m['pricing.intro']()}</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                {m['pricing.free_name']()}
                {me && !onPlus && <Badge>{m['billing.current_plan']()}</Badge>}
              </CardTitle>
              <CardDescription className="text-base">{m['pricing.free_price']()}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-base">{m['pricing.free_body']()}</p>
            </CardContent>
            {!me && (
              <CardFooter className="mt-auto border-t border-border py-4">
                <Link to="/start" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
                  {m['home.cta_example']()}
                </Link>
              </CardFooter>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                {m['pricing.plus_name']()}
                {onPlus && <Badge>{m['billing.current_plan']()}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <PlanChoice
                plans={plans.plans}
                value={plan}
                onChange={setPlan}
                className="sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2"
              />
              <p className="text-base">{m['plan.cancel_anytime']()}</p>
            </CardContent>
            <CardFooter className="mt-auto border-t border-border py-4">
              <PlusAction me={me} plan={plan} />
            </CardFooter>
          </Card>
        </div>

        <table className="w-full border-collapse text-left text-base">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-3 pr-4 font-semibold">
                {m['pricing.plan_column']()}
              </th>
              <th scope="col" className="w-18 py-3 pr-2 font-semibold sm:w-40">
                {m['pricing.free_name']()}
              </th>
              <th scope="col" className="w-22 py-3 font-semibold sm:w-44">
                {m['pricing.plus_name']()}
              </th>
            </tr>
          </thead>
          {matrix(plans).map(({ group, rows }) => (
            <tbody key={group}>
              <tr>
                <th scope="colgroup" colSpan={3} className="pt-6 pb-2 text-lg font-semibold">
                  {group}
                </th>
              </tr>
              {rows.map(([feature, free, plus]) => (
                <tr key={feature} className="border-b border-border align-top">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    {feature}
                  </th>
                  <td className="py-3 pr-2">
                    <MatrixCell value={free} />
                  </td>
                  <td className="py-3">
                    <MatrixCell value={plus} />
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  )
}
