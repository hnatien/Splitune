import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { Skeleton } from '@/ui/skeleton'
import { Banner, InlineError } from '@/ui/status-message'
import { BillingCard } from './billing-card'
import { billingClient, billingOrpc, planName, planPrice, plansQuery, useRefreshMe } from './plans'

// Mock checkout (27 §3.10, 25 §2): the demo banner, the plan and its price on the Pricing card, and
// three buttons that make the mock provider act — success sends the real webhook event, declined
// and cancel create nothing. No card fields, ever.

type Outcome = 'success' | 'declined' | 'cancel'

export function SessionExpired() {
  return (
    <InlineError
      title={m['billing.session_expired']()}
      actions={
        <Link to="/settings/account" hash="plan" className={buttonVariants({ variant: 'outline' })}>
          {m['billing.go_billing']()}
        </Link>
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
  const button = (outcome: Outcome, label: string, variant: 'primary' | 'secondary' | 'ghost') => (
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
      <h1 className="text-2xl">{m['billing.checkout_title']()}</h1>
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
              actions={
                <Button variant="outline" onClick={() => setDeclined(false)}>
                  {m['common.try_again']()}
                </Button>
              }
            />
          )}
          {failed && <InlineError title={m['billing.action_failed']()} />}
          <div className="flex flex-col gap-2">
            {button('success', m['billing.simulate_success'](), 'primary')}
            {button('declined', m['billing.simulate_declined'](), 'secondary')}
            {button('cancel', m['common.cancel'](), 'ghost')}
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
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      )}
    </>
  )
}
