import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { InlineError } from '@/ui/status-message'
import { SettingsPage } from '../settings/setting-row'
import { billingClient, periodLine, planName, portalAction, useRefreshMe } from './plans'
import { UpgradeSheet } from './upgrade-sheet'

// Settings → Plan (27 §3.9, §3.10): the "Demo billing" badge, then the plan between hairlines with
// the Welcome status or renewal line and its action: See Plus on Free; Cancel or Resume Plus and
// Manage plan on Plus (14 §4.4: one tap, never a retention maze). The allowances are on Usage.
// The return states of checkout land here.

// A checkout cancelled from Settings comes back here to say so.
export const CANCELLED_PATH = '/settings/plan?checkout=cancelled'

export function PlanSettings({
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
    <SettingsPage
      title={m['settings.billing']()}
      badge={<Badge variant="primary">{m['settings.demo_billing']()}</Badge>}
    >
      <div className="flex flex-col gap-3">
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

        <div className="flex flex-col divide-y divide-border border-y border-border">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-5">
            <div className="flex min-w-0 grow basis-65 flex-col gap-1">
              <p className="text-title">
                {plus ? planName(subscription.plan) : m['billing.plan_free']()}
              </p>
              {plus ? (
                <>
                  <p className="text-body-sm text-muted-foreground">{periodLine(current)}</p>
                  {subscription.status === 'past_due' && (
                    <p className="text-body-sm text-muted-foreground">
                      {m['billing.status_past_due']()}
                    </p>
                  )}
                  {lite.cap === null && (
                    <p className="text-body-sm text-muted-foreground">
                      {m['billing.lite_unlimited']()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-body-sm text-muted-foreground">
                  {current.usage.welcome_available
                    ? m['billing.welcome_unused']()
                    : m['billing.welcome_used']()}
                </p>
              )}
            </div>
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
                      loading={pending === 'cancel'}
                      disabled={pending !== undefined}
                      onClick={() => run('cancel')}
                    >
                      {m['billing.cancel_plus']()}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
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
          </div>
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
      </div>
      <UpgradeSheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        trigger="settings"
        returnPath={CANCELLED_PATH}
      />
    </SettingsPage>
  )
}
