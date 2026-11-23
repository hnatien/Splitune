import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { useHydrated } from '@/lib/use-hydrated'
import { Button, buttonVariants } from '@/ui/button'
import { Skeleton } from '@/ui/skeleton'
import { Banner, InlineError, type StatusTone } from '@/ui/status-message'
import { BillingCard } from './billing-card'
import { SessionExpired } from './mock-checkout'
import {
  billingClient,
  billingOrpc,
  type PortalAction,
  periodLine,
  planName,
  useRefreshMe,
} from './plans'

// Mock portal (27 §3.10, 25 §2), laid out like mock checkout: the plan and its renewal date; cancel
// at period end in one tap with a confirmation line (no "are you sure" loop), resume, switch
// monthly ↔ yearly, then the simulations apart from them under their own heading. Every button
// goes through the provider's webhook. Cancelling is an outline button, not the page's filled
// one: only Resume, the action a cancelling subscriber came for, is filled. A failed payment is
// shown with the warning glyph, never the success one, and the confirmation line takes focus so
// a keyboard user lands on what just happened.

function confirmation(action: PortalAction, me: MeData): { tone: StatusTone; text: string } {
  const end = me.subscription?.current_period_end
  const date = end ? formatDate(new Date(end)) : ''
  switch (action) {
    case 'cancel':
      return { tone: 'info', text: m['billing.cancelled_at_period_end']({ date }) }
    case 'resume':
      return { tone: 'success', text: m['billing.resumed']({ date }) }
    case 'switch':
      return {
        tone: 'success',
        text: m['billing.switched']({
          plan: planName(me.subscription?.plan ?? 'paid_monthly'),
          date,
        }),
      }
    case 'payment_failed':
      return { tone: 'warning', text: m['billing.payment_failed']() }
    case 'refund':
      return { tone: 'success', text: m['billing.refunded']() }
  }
}

export function MockPortal({ session }: { session: string }) {
  const details = useQuery(billingOrpc.billing.mockSession.queryOptions({ input: { session } }))
  const me = useQuery(meQuery).data
  const refreshMe = useRefreshMe()
  const [pending, setPending] = useState<PortalAction | undefined>()
  const [done, setDone] = useState<PortalAction | undefined>()
  const [failed, setFailed] = useState(false)
  const outcomeLine = useRef<HTMLDivElement>(null)
  // Server-rendered: the renewal date in UTC until hydrated (formatDate).
  const zone = useHydrated() ? undefined : 'UTC'

  useEffect(() => {
    if (done) outcomeLine.current?.focus()
  }, [done])

  const act = async (action: PortalAction) => {
    setPending(action)
    setDone(undefined)
    setFailed(false)
    try {
      await billingClient.billing.mockPortal({ session, action })
      await refreshMe()
      setDone(action)
    } catch {
      setFailed(true)
    } finally {
      setPending(undefined)
    }
  }
  const button = (
    action: PortalAction,
    label: string,
    variant: 'primary' | 'outline',
    size: 'lg' | 'md' = 'lg',
  ) => (
    <Button
      variant={variant}
      size={size}
      block={size === 'lg'}
      loading={pending === action}
      disabled={pending !== undefined}
      onClick={() => act(action)}
    >
      {label}
    </Button>
  )

  const subscription = me?.subscription ?? null
  const plus = me != null && me.plan !== 'free' && subscription !== null
  const outcome = done && me ? confirmation(done, me) : undefined
  return (
    <>
      <Banner tone="info" title={m['billing.demo']()} />
      <h1 className="pt-6 text-display text-balance">{m['billing.portal_title']()}</h1>
      {details.isError || me === null ? (
        <SessionExpired />
      ) : !details.data || !me ? (
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-12 rounded-full" />
        </div>
      ) : (
        <>
          <BillingCard
            title={plus ? planName(subscription.plan) : m['billing.plan_free']()}
            note={plus ? periodLine(me, zone) : undefined}
          >
            {plus && subscription.status === 'past_due' && (
              <InlineError tone="warning" title={m['billing.status_past_due']()} />
            )}
            {outcome && (
              <div ref={outcomeLine} tabIndex={-1} className="rounded-field">
                <InlineError tone={outcome.tone} title={outcome.text} />
              </div>
            )}
            {failed && <InlineError title={m['billing.action_failed']()} />}
            {plus && (
              <div className="flex flex-col gap-2">
                {subscription.cancel_at_period_end
                  ? button('resume', m['billing.resume_plus'](), 'primary')
                  : button('cancel', m['billing.cancel_plus'](), 'outline')}
                {button(
                  'switch',
                  subscription.plan === 'paid_yearly'
                    ? m['billing.switch_monthly']()
                    : m['billing.switch_yearly'](),
                  'outline',
                )}
              </div>
            )}
          </BillingCard>
          {plus && (
            <section aria-labelledby="simulations" className="flex flex-col gap-3 pt-4">
              <div className="flex flex-col gap-1">
                <h2 id="simulations" className="text-label">
                  {m['billing.simulations']()}
                </h2>
                <p className="text-body-sm text-muted-foreground">
                  {m['billing.simulations_hint']()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {button('payment_failed', m['billing.simulate_payment_failure'](), 'outline', 'md')}
                {button('refund', m['billing.simulate_refund'](), 'outline', 'md')}
              </div>
            </section>
          )}
          <Link
            to={details.data.return_url}
            className={buttonVariants({ variant: 'quiet', className: 'mt-4 self-start' })}
          >
            {m['billing.back_to_settings']()}
          </Link>
        </>
      )}
    </>
  )
}
