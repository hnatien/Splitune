import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { Skeleton } from '@/ui/skeleton'
import { Banner, InlineError } from '@/ui/status-message'
import { useSignedIn } from '../system/system-message'
import { BillingCard } from './billing-card'
import { billingClient, billingOrpc, planName, planPrice, plansQuery, useRefreshMe } from './plans'

// Mock checkout (27 §3.10, 25 §2): the demo line, the plan and its price, and three buttons that
// make the mock provider act, ranked by weight: success (the one filled control) sends the real
// webhook event, declined and cancel create nothing. A declined card says so where it happened and
// leaves the three outcomes to pick again. No card fields, ever.

type Outcome = 'success' | 'declined' | 'cancel'

/**
 * The link is old or belongs to someone else: say so, and the way to start again for who is
 * reading (Settings → Plan when signed in, sign in first when not).
 */
export function SessionExpired() {
  const signedIn = useSignedIn()
  return (
    <InlineError
      title={m['billing.session_expired']()}
      description={signedIn ? m['billing.expired_signed_in']() : m['billing.expired_signed_out']()}
      actions={
        signedIn ? (
          <Link to="/settings/plan" className={buttonVariants({ variant: 'outline' })}>
            {m['billing.go_billing']()}
          </Link>
        ) : (
          <Link
            to="/auth/sign-in"
            search={{ next: '/settings/plan' }}
            className={buttonVariants({ variant: 'outline' })}
          >
            {m['nav.sign_in']()}
          </Link>
        )
      }
    />
  )
}

export function MockCheckout({ session }: { session: string }) {
  const details = useQuery(billingOrpc.billing.mockSession.queryOptions({ input: { session } }))
  const plans = useQuery(plansQuery)
  const navigate = useNavigate()
  const refreshMe = useRefreshMe()
  const [pending, setPending] = useState<Outcome | undefined>()
  const [declined, setDeclined] = useState(false)
  const [failed, setFailed] = useState(false)

  const plan = plans.data?.plans.find((p) => p.plan === details.data?.plan)

  const act = async (outcome: Outcome) => {
    setPending(outcome)
    setDeclined(false)
    setFailed(false)
    try {
      const result = await billingClient.billing.mockCheckout({ session, outcome })
      if (result.url === null) {
        setDeclined(true)
        return
      }
      if (outcome === 'success') await refreshMe()
      await navigate({ href: result.url })
    } catch {
      setFailed(true)
    } finally {
      setPending(undefined)
    }
  }
  const button = (outcome: Outcome, label: string, variant: 'primary' | 'outline' | 'quiet') => (
    <Button
      variant={variant}
      size="lg"
      block
      loading={pending === outcome}
      disabled={pending !== undefined}
      onClick={() => act(outcome)}
    >
      {label}
    </Button>
  )

  return (
    <>
      <Banner tone="info" title={m['billing.demo']()} />
      <h1 className="pt-6 text-display">{m['billing.checkout_title']()}</h1>
      {details.isError ? (
        <SessionExpired />
      ) : details.data && plan ? (
        <BillingCard
          title={planName(plan.plan)}
          price={planPrice(plan)}
          note={m['billing.renews_note']()}
        >
          {declined && (
            <InlineError
              title={m['billing.declined']()}
              description={m['billing.declined_next']()}
            />
          )}
          {failed && <InlineError title={m['billing.action_failed']()} />}
          <div className="flex flex-col gap-2">
            {button('success', m['billing.simulate_success'](), 'primary')}
            {button('declined', m['billing.simulate_declined'](), 'outline')}
            {button('cancel', m['common.cancel'](), 'quiet')}
          </div>
        </BillingCard>
      ) : plans.isError ? (
        <InlineError
          title={m['plan.prices_failed']()}
          actions={
            <Button variant="outline" onClick={() => plans.refetch()}>
              {m['common.try_again']()}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="mt-6 h-12 rounded-full" />
          <Skeleton className="h-12 rounded-full" />
        </div>
      )}
    </>
  )
}
