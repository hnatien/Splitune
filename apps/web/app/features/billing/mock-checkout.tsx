import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Skeleton } from '@/ui/skeleton'
import { Banner, InlineError } from '@/ui/status-message'
import { billingClient, billingOrpc, planName, planPrice, plansQuery, useRefreshMe } from './plans'

// Mock checkout (27 §3.10, 25 §2): the demo banner, the plan and its price, and three buttons
// that make the mock provider act — success sends the real webhook event, declined and cancel
// create nothing. No card fields, ever.

type Outcome = 'success' | 'declined' | 'cancel'

export function SessionExpired() {
  return (
    <InlineError
      title={m['billing.session_expired']()}
      actions={
        <Link to="/settings/billing" className={buttonVariants({ variant: 'outline' })}>
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

  return (
    <>
      <Banner tone="info" title={m['billing.demo']()} />
      <h1 className="text-2xl">{m['billing.checkout_title']()}</h1>
      {details.isError ? (
        <SessionExpired />
      ) : details.data && plan ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{planName(plan.plan)}</CardTitle>
              <CardDescription className="text-base tabular-nums">
                {planPrice(plan)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-base">{m['billing.renews_note']()}</p>
            </CardContent>
          </Card>
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
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              loading={pending === 'success'}
              disabled={pending !== undefined}
              onClick={() => act('success')}
            >
              {m['billing.simulate_success']()}
            </Button>
            <Button
              variant="outline"
              loading={pending === 'declined'}
              disabled={pending !== undefined}
              onClick={() => act('declined')}
            >
              {m['billing.simulate_declined']()}
            </Button>
            <Button
              variant="ghost"
              loading={pending === 'cancel'}
              disabled={pending !== undefined}
              onClick={() => act('cancel')}
            >
              {m['common.cancel']()}
            </Button>
          </div>
        </>
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
          <Skeleton className="h-36" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      )}
    </>
  )
}
