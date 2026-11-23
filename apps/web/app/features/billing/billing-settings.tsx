import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { Button, buttonVariants } from '@/ui/button'
import { Stat, Stats } from '@/ui/stat'
import { InlineError } from '@/ui/status-message'
import { SettingRows, SettingSection, SettingsPage } from '../settings/setting-row'
import { billingClient, periodLine, planName, portalAction, useRefreshMe } from './plans'
import { UpgradeSheet } from './upgrade-sheet'

// Settings → Plan (27 §3.9, §3.10): "Demo billing" said once under the title, then what is left
// this period as figures (26 §12.2 Stat) with the way to Usage, then the plan between hairlines
// with the Welcome status or renewal line and its actions: See Plus on Free (the page's one filled
// control); on Plus, Manage plan with Cancel Plus beside it as the quieter path, or Resume Plus
// while it is cancelling (14 §4.4: one tap, never a retention maze). Checkout returns land here.

// A checkout cancelled from Settings comes back here to say so.
export const CANCELLED_PATH = '/settings/plan?checkout=cancelled'

/** "3 of 5" left, or the count used when the plan has no limit. */
function allowanceStats(me: MeData) {
  const plus = me.plan !== 'free' && me.subscription !== null
  const { full, lite } = me.usage
  const left = (used: number, cap: number) =>
    m['billing.stat_of']({ left: String(Math.max(0, cap - used)), limit: String(cap) })
  return [
    plus
      ? full.cap === null
        ? undefined
        : { value: left(full.used, full.cap), label: m['billing.stat_full_left']() }
      : {
          value: left(me.usage.welcome_available ? 0 : 1, 1),
          label: m['billing.stat_welcome_left'](),
        },
    lite.cap === null
      ? { value: m['billing.stat_no_limit'](), label: m['settings.plan_lite']() }
      : { value: left(lite.used, lite.cap), label: m['billing.stat_lite_left']() },
  ].filter((stat) => stat !== undefined)
}

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
    <SettingsPage title={m['settings.billing']()} intro={m['billing.demo']()}>
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

      <SettingSection id="left" title={m['billing.this_period']()}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t border-border pt-4">
          <Stats>
            {allowanceStats(current).map((stat) => (
              <Stat key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </Stats>
          <Link to="/settings/usage" className={buttonVariants({ variant: 'quiet', size: 'sm' })}>
            {m['billing.see_usage']()}
          </Link>
        </div>
      </SettingSection>

      <SettingSection id="plan" title={m['billing.current_plan']()}>
        <SettingRows>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex min-w-0 grow basis-65 flex-col gap-0.5">
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
            <div className="flex flex-wrap gap-2">
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
                      variant="quiet"
                      loading={pending === 'cancel'}
                      disabled={pending !== undefined}
                      onClick={() => run('cancel')}
                    >
                      {m['billing.cancel_plus']()}
                    </Button>
                  )}
                  <Button
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
        </SettingRows>
        {cancelled && subscription?.cancel_at_period_end && (
          <InlineError
            tone="success"
            title={m['billing.cancelled_at_period_end']({
              date: resets(subscription.current_period_end),
            })}
          />
        )}
        {failed && <InlineError title={m['billing.action_failed']()} />}
      </SettingSection>
      <UpgradeSheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        trigger="settings"
        returnPath={CANCELLED_PATH}
      />
    </SettingsPage>
  )
}
