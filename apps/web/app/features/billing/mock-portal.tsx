import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { useHydrated } from '@/lib/use-hydrated'
import { Button, buttonVariants } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Skeleton } from '@/ui/skeleton'
import { Banner, InlineError } from '@/ui/status-message'
import { SessionExpired } from './mock-checkout'
import {
  billingClient,
  billingOrpc,
  type PortalAction,
  periodLine,
  planName,
  useRefreshMe,
} from './plans'

// Mock portal (27 §3.10, 25 §2): the plan and its renewal date; cancel at period end in one tap
// with a confirmation line (no "are you sure" loop), resume, switch monthly ↔ yearly, and the
// simulated payment failure and refund. Every button goes through the provider's webhook.

function confirmation(action: PortalAction, me: MeData): string {
  const end = me.subscription?.current_period_end
  const date = end ? formatDate(new Date(end)) : ''
  switch (action) {
    case 'cancel':
      return m['billing.cancelled_at_period_end']({ date })
    case 'resume':
      return m['billing.resumed']({ date })
    case 'switch':
      return m['billing.switched']({
        plan: planName(me.subscription?.plan ?? 'paid_monthly'),
        date,
      })
    case 'payment_failed':
      return m['billing.payment_failed']()
    case 'refund':
      return m['billing.refunded']()
  }
}

export function MockPortal({ session }: { session: string }) {
  const details = useQuery(billingOrpc.billing.mockSession.queryOptions({ input: { session } }))
  const me = useQuery(meQuery).data
  const refreshMe = useRefreshMe()
  const [pending, setPending] = useState<PortalAction | undefined>()
  const [done, setDone] = useState<PortalAction | undefined>()
  const [failed, setFailed] = useState(false)
  // Server-rendered: the renewal date in UTC until hydrated (formatDate).
  const zone = useHydrated() ? undefined : 'UTC'

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
  const button = (action: PortalAction, label: string, variant: 'primary' | 'outline') => (
    <Button
      variant={variant}
      loading={pending === action}
      disabled={pending !== undefined}
      onClick={() => act(action)}
    >
      {label}
    </Button>
  )

  const subscription = me?.subscription ?? null
  const plus = me != null && me.plan !== 'free' && subscription !== null
  return (
    <>
      <Banner tone="info" title={m['billing.demo']()} />
      <h1 className="text-2xl">{m['billing.portal_title']()}</h1>
      {details.isError || me === null ? (
        <SessionExpired />
      ) : !details.data || !me ? (
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-28" />
          <Skeleton className="h-11" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                {plus ? planName(subscription.plan) : m['billing.plan_free']()}
              </CardTitle>
              {plus && (
                <CardDescription className="text-base">{periodLine(me, zone)}</CardDescription>
              )}
            </CardHeader>
            {plus && subscription.status === 'past_due' && (
              <CardContent>
                <p className="text-base">{m['billing.status_past_due']()}</p>
              </CardContent>
            )}
          </Card>
          {done && <InlineError tone="success" title={confirmation(done, me)} />}
          {failed && <InlineError title={m['billing.action_failed']()} />}
          {plus && (
            <>
              <div className="flex flex-col gap-3">
                {subscription.cancel_at_period_end
                  ? button('resume', m['billing.resume_plus'](), 'primary')
                  : button('cancel', m['billing.cancel_plus'](), 'primary')}
                {button(
                  'switch',
                  subscription.plan === 'paid_yearly'
                    ? m['billing.switch_monthly']()
                    : m['billing.switch_yearly'](),
                  'outline',
                )}
              </div>
              <section className="flex flex-col gap-3">
                <h2 className="text-lg">{m['billing.simulations']()}</h2>
                {button('payment_failed', m['billing.simulate_payment_failure'](), 'outline')}
                {button('refund', m['billing.simulate_refund'](), 'outline')}
              </section>
            </>
          )}
          <Link
            to={details.data.return_url}
            className={buttonVariants({ variant: 'ghost', className: 'self-start' })}
          >
            {m['billing.back_to_settings']()}
          </Link>
        </>
      )}
    </>
  )
}
