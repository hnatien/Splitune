import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { AllowanceMeter } from '@/ui/allowance-meter'
import { Button } from '@/ui/button'
import { InlineError } from '@/ui/status-message'
import { UsageMeter } from '../shell/usage-meter'
import { billingClient, periodLine, planName, portalAction, useRefreshMe } from './plans'
import { UpgradeSheet } from './upgrade-sheet'

// Settings → Plan & billing (27 §3.9): the plan, allowances with their reset dates, the renewal
// date, Manage (→ mock portal) and one-tap Cancel (14 §4.4: never a retention maze). The return
// states of checkout (27 §3.10) land here.

// A checkout cancelled from here comes back to say so.
const CANCELLED_PATH = '/settings/billing?checkout=cancelled'

export function BillingSettings({
  me,
  checkout,
}: {
  me: MeData
  checkout?: 'success' | 'cancelled' | undefined
}) {
  const current = useQuery({ ...meQuery, initialData: me }).data ?? me
  const refreshMe = useRefreshMe()
  const navigate = useNavigate()
  const [upgrading, setUpgrading] = useState(false)
  const [pending, setPending] = useState<'cancel' | 'resume' | 'manage' | undefined>()
  const [cancelled, setCancelled] = useState(false)
  const [failed, setFailed] = useState(false)

  const subscription = current.subscription
  const plus = current.plan !== 'free' && subscription !== null
  const { full, lite } = current.usage
  const resets = (iso: string | null) => (iso ? formatDate(new Date(iso)) : '')

  const run = async (action: 'cancel' | 'resume' | 'manage') => {
    setPending(action)
    setFailed(false)
    try {
      if (action === 'manage') {
        const { url } = await billingClient.billing.portal()
        await navigate({ href: url })
        return
      }
      await portalAction(action)
      await refreshMe()
      setCancelled(action === 'cancel')
    } catch {
      setFailed(true)
    } finally {
      setPending(undefined)
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-xl">{m['settings.billing']()}</h2>
      {checkout === 'success' && plus && (
        <InlineError
          tone="success"
          title={m['billing.success']({
            limit: String(full.cap ?? 0),
            date: resets(full.resets_at),
          })}
        />
      )}
      {checkout === 'cancelled' && (
        <InlineError tone="info" title={m['billing.checkout_cancelled']()} />
      )}

      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{m['billing.current_plan']()}</p>
        <p className="text-lg font-semibold">
          {plus ? planName(subscription.plan) : m['billing.plan_free']()}
        </p>
        {plus && <p className="text-base">{periodLine(current)}</p>}
        {plus && subscription.status === 'past_due' && (
          <p className="text-base">{m['billing.status_past_due']()}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {plus ? (
          <>
            {full.cap !== null && (
              <AllowanceMeter
                left={Math.max(0, full.cap - full.used)}
                limit={full.cap}
                text={m['billing.full_allowance']({
                  left: String(Math.max(0, full.cap - full.used)),
                  limit: String(full.cap),
                  date: resets(full.resets_at),
                })}
              />
            )}
            {lite.cap === null && <p className="text-base">{m['billing.lite_unlimited']()}</p>}
          </>
        ) : (
          <>
            <p className="text-base">
              {current.usage.welcome_available
                ? m['billing.welcome_unused']()
                : m['billing.welcome_used']()}
            </p>
            <UsageMeter me={current} />
          </>
        )}
      </div>

      {cancelled && subscription?.cancel_at_period_end && (
        <InlineError
          tone="success"
          title={m['billing.cancelled_at_period_end']({
            date: resets(subscription.current_period_end),
          })}
        />
      )}
      {failed && <InlineError title={m['billing.action_failed']()} />}

      <div className="flex flex-wrap gap-3">
        {plus ? (
          <>
            {subscription.cancel_at_period_end ? (
              <Button
                variant="primary"
                loading={pending === 'resume'}
                disabled={pending !== undefined}
                onClick={() => run('resume')}
              >
                {m['billing.resume_plus']()}
              </Button>
            ) : (
              <Button
                variant="outline"
                loading={pending === 'cancel'}
                disabled={pending !== undefined}
                onClick={() => run('cancel')}
              >
                {m['billing.cancel_plus']()}
              </Button>
            )}
            <Button
              variant="outline"
              loading={pending === 'manage'}
              disabled={pending !== undefined}
              onClick={() => run('manage')}
            >
              {m['billing.manage']()}
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => setUpgrading(true)}>
            {m['plan.see_plus']()}
          </Button>
        )}
      </div>
      <UpgradeSheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        trigger="settings"
        returnPath={CANCELLED_PATH}
      />
    </section>
  )
}
