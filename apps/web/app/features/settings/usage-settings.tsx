import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/ui/button'
import { Meter, MeterLabel, MeterValue } from '@/ui/meter'
import { CANCELLED_PATH } from '../billing/billing-settings'
import { periodLine, planName } from '../billing/plans'
import { UpgradeSheet } from '../billing/upgrade-sheet'
import { SettingRows, SettingSection, SettingsPage } from './setting-row'

// Settings → Usage: every analysis allowance as a row (the label with its reset date, a bar of what
// is used, "3 of 5 used"), then the plan they come from with the way to Plus or to Plan. Rows share
// one grid so the bars line up; on phones the bar drops under the label.

const ROW =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_8rem]'

export type UsageItem = { id: string; label: string; hint?: string | undefined } & (
  | { used: number; limit: number }
  | { note: string }
)

/**
 * The allowances in the order they matter: Full (Plus' bar, or "Part of Plus"), Lite (its bar, or
 * what's used with no limit on Plus), and the Welcome analysis on Free. Settings → Usage and the
 * app bar's Usage popover both list these.
 */
export function usageItems(me: MeData): UsageItem[] {
  const { full, lite, welcome_available } = me.usage
  const plus = me.plan !== 'free' && me.subscription !== null
  const resets = (iso: string | null) =>
    iso ? m['settings.usage_resets']({ date: formatDate(new Date(iso)) }) : undefined
  const items: UsageItem[] = [
    full.cap
      ? {
          id: 'full',
          label: m['settings.plan_full'](),
          hint: resets(full.resets_at),
          used: Math.min(full.used, full.cap),
          limit: full.cap,
        }
      : { id: 'full', label: m['settings.plan_full'](), note: m['settings.usage_plus_only']() },
    lite.cap === null
      ? {
          id: 'lite',
          label: m['settings.plan_lite'](),
          hint: resets(lite.resets_at),
          note: m['settings.usage_used_no_limit']({ used: String(lite.used) }),
        }
      : {
          id: 'lite',
          label: m['settings.plan_lite'](),
          hint: resets(lite.resets_at),
          used: Math.min(lite.used, lite.cap),
          limit: lite.cap,
        },
  ]
  if (!plus) {
    items.push({
      id: 'welcome',
      label: m['settings.usage_welcome'](),
      hint: m['settings.usage_welcome_hint'](),
      used: welcome_available ? 0 : 1,
      limit: 1,
    })
  }
  return items
}

/** "3 of 5 used", and the meter's spoken value with its reset date. */
export function usedText(item: { used: number; limit: number; hint?: string | undefined }) {
  const value = m['settings.usage_used']({ used: String(item.used), limit: String(item.limit) })
  return { value, spoken: item.hint ? `${value}, ${item.hint}` : value }
}

export function UsageSettings({ me }: { me: MeData }) {
  const current = useQuery({ ...meQuery, initialData: me }).data ?? me
  const [upgrading, setUpgrading] = useState(false)
  const plus = current.plan !== 'free' && current.subscription !== null

  return (
    <SettingsPage title={m['settings.usage']()}>
      <SettingSection
        id="limits"
        title={m['settings.usage_limits']()}
        description={m['settings.usage_limits_hint']()}
      >
        <SettingRows>
          {usageItems(current).map((item) =>
            'limit' in item ? (
              <UsageMeter key={item.id} {...item} />
            ) : (
              <UsageNote key={item.id} {...item} />
            ),
          )}
        </SettingRows>
      </SettingSection>

      <SettingSection id="plan" title={m['settings.usage_plan']()}>
        <SettingRows>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex min-w-0 grow basis-50 flex-col gap-0.5">
              <p className="text-label">
                {plus && current.subscription
                  ? planName(current.subscription.plan)
                  : m['billing.plan_free']()}
              </p>
              {plus && <p className="text-body-sm text-muted-foreground">{periodLine(current)}</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              {plus ? (
                <Link to="/settings/plan" className={buttonVariants({ variant: 'outline' })}>
                  {m['settings.view_plan']()}
                </Link>
              ) : (
                <>
                  <Link to="/settings/plan" className={buttonVariants({ variant: 'quiet' })}>
                    {m['settings.view_plan']()}
                  </Link>
                  <Button variant="primary" onClick={() => setUpgrading(true)}>
                    {m['plan.see_plus']()}
                  </Button>
                </>
              )}
            </div>
          </div>
        </SettingRows>
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

function LabelColumn({ label, hint }: { label: ReactNode; hint?: string | undefined }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {label}
      {hint && <span className="text-body-sm text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** "Lite analyses · Resets 1 Dec" | bar | "1 of 5 used"; the bar fills with what is used. */
function UsageMeter({
  label,
  hint,
  used,
  limit,
}: {
  label: string
  hint?: string | undefined
  used: number
  limit: number
}) {
  const { value, spoken } = usedText({ used, limit, hint })
  return (
    <Meter
      value={used}
      min={0}
      max={limit}
      getAriaValueText={() => spoken}
      className={cn(
        ROW,
        '*:data-[slot=meter-track]:col-span-2 sm:*:data-[slot=meter-track]:col-span-1 sm:*:data-[slot=meter-track]:col-start-2 sm:*:data-[slot=meter-track]:row-start-1',
      )}
    >
      <LabelColumn label={<MeterLabel className="text-label">{label}</MeterLabel>} hint={hint} />
      <MeterValue className="text-right sm:col-start-3">{() => value}</MeterValue>
    </Meter>
  )
}

/** A row with no bar: an allowance with no limit, or one this plan doesn't have. */
function UsageNote({
  label,
  hint,
  note,
}: {
  label: string
  hint?: string | undefined
  note: string
}) {
  return (
    <div className={ROW}>
      <LabelColumn label={<span className="text-label">{label}</span>} hint={hint} />
      <p className="text-right text-body-sm text-muted-foreground sm:col-span-2">{note}</p>
    </div>
  )
}
