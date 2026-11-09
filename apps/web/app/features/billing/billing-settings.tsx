import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Meter, MeterLabel, MeterValue } from '@/ui/meter'
import { InlineError } from '@/ui/status-message'
import { SettingSection } from '../settings/setting-row'
import { billingClient, periodLine, planName, portalAction, useRefreshMe } from './plans'
import { UpgradeSheet } from './upgrade-sheet'

// Settings → Account → Plan (27 §3.9, Settings-Account): the "Demo billing" badge, then one card
// with the plan, the Welcome status or renewal line, the allowance that limits new analyses and
// the action: See Plus on Free; Cancel or Resume Plus and Manage plan on Plus (14 §4.4: one tap,
// never a retention maze). The return states of checkout (27 §3.10) land here.

// A checkout cancelled from here comes back to say so.
const CANCELLED_PATH = '/settings/account?checkout=cancelled#plan'

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
  // The allowance that limits new analyses (23 §5): Lite on Free, full analyses on Plus.
  const allowance = plus ? full : lite

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
    <SettingSection
      id="plan"
      title={m['settings.billing']()}
      aside={<Badge variant="primary">{m['settings.demo_billing']()}</Badge>}
    >
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

      <Card className="flex-row flex-wrap items-center gap-x-6 gap-y-4 p-5">
        <div className="flex min-w-0 grow basis-65 flex-col gap-1">
          <p className="text-xl">{plus ? planName(subscription.plan) : m['billing.plan_free']()}</p>
          {plus ? (
            <>
              <p className="text-sm text-muted-foreground">{periodLine(current)}</p>
              {subscription.status === 'past_due' && (
                <p className="text-sm text-muted-foreground">{m['billing.status_past_due']()}</p>
              )}
              {lite.cap === null && (
                <p className="text-sm text-muted-foreground">{m['billing.lite_unlimited']()}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {current.usage.welcome_available
                ? m['billing.welcome_unused']()
                : m['billing.welcome_used']()}
            </p>
          )}
        </div>
        {allowance.cap !== null && (
          <Allowance
            label={plus ? m['settings.plan_full']() : m['settings.plan_lite']()}
            left={Math.max(0, allowance.cap - allowance.used)}
            limit={allowance.cap}
            date={resets(allowance.resets_at)}
          />
        )}
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
      </Card>

      {cancelled && subscription?.cancel_at_period_end && (
        <InlineError
          tone="success"
          title={m['billing.cancelled_at_period_end']({
            date: resets(subscription.current_period_end),
          })}
        />
      )}
      {failed && <InlineError title={m['billing.action_failed']()} />}
      <UpgradeSheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        trigger="settings"
        returnPath={CANCELLED_PATH}
      />
    </SettingSection>
  )
}

/** "Lite analyses · 3 of 5 left · resets 1 Dec" over a 4 px bar (27 §3.9). */
function Allowance({
  label,
  left,
  limit,
  date,
}: {
  label: string
  left: number
  limit: number
  date: string
}) {
  const value = m['settings.plan_left']({ left: String(left), limit: String(limit), date })
  return (
    <Meter
      value={left}
      min={0}
      max={limit}
      getAriaValueText={() => value}
      className="min-w-0 grow basis-65 gap-y-1.5 **:data-[slot=meter-track]:h-1"
    >
      <MeterLabel className="font-normal">{label}</MeterLabel>
      <MeterValue>{() => value}</MeterValue>
    </Meter>
  )
}
