import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { useState } from 'react'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { Button, buttonVariants } from '@/ui/button'
import { Meter, MeterLabel, MeterValue } from '@/ui/meter'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { CANCELLED_PATH } from '../billing/billing-settings'
import { periodLine, planName } from '../billing/plans'
import { UpgradeSheet } from '../billing/upgrade-sheet'
import { usageItems, usedText } from '../settings/usage-settings'

// The app bar's Usage popover: what this period's allowances have used, one compact row each
// ("Lite analyses … 1 of 5 used", a bar, "Resets 1 Dec"), then the plan with View plan and, on
// Free, See Plus as a compact quiet pill. Settings → Usage and Plan hold the full pages. `trigger`
// is the bar's ghost pill or the phone bottom bar's tab; the popover opens below the first and
// above the second.
export function UsagePopover({
  me: initial,
  trigger,
  side = 'bottom',
}: {
  me: MeData
  trigger: React.ReactElement
  side?: 'top' | 'bottom'
}) {
  const me = useQuery({ ...meQuery, initialData: initial }).data ?? initial
  const [open, setOpen] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const plus = me.plan !== 'free' && me.subscription !== null
  const close = () => setOpen(false)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={trigger} />
        <PopoverContent
          side={side}
          align={side === 'top' ? 'center' : 'start'}
          // Above the phone bar, clear of its top padding as well as the tab.
          sideOffset={side === 'top' ? 20 : 8}
          className="gap-0 p-0"
        >
          <div className="flex flex-col gap-4 p-4">
            <PopoverTitle className="text-body">{m['settings.usage_limits']()}</PopoverTitle>
            {usageItems(me).map((item) =>
              'limit' in item ? (
                <UsageBar key={item.id} {...item} />
              ) : (
                <div key={item.id} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{item.label}</span>
                    <span className="text-right text-muted-foreground">{item.note}</span>
                  </div>
                  {item.hint && (
                    <span className="text-caption text-faint-foreground">{item.hint}</span>
                  )}
                </div>
              ),
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border p-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span>
                {plus && me.subscription
                  ? planName(me.subscription.plan)
                  : m['billing.plan_free']()}
              </span>
              {plus && <span className="text-caption text-muted-foreground">{periodLine(me)}</span>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                to="/settings/plan"
                onClick={close}
                className={buttonVariants({ variant: plus ? 'outline' : 'quiet', size: 'sm' })}
              >
                {m['settings.view_plan']()}
              </Link>
              {!plus && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    close()
                    setUpgrading(true)
                  }}
                >
                  {m['plan.see_plus']()}
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <UpgradeSheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        trigger="settings"
        returnPath={CANCELLED_PATH}
      />
    </>
  )
}

/** "Lite analyses … 1 of 5 used" over a 4 px bar, the reset date under it. */
function UsageBar({
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
    <div className="flex flex-col gap-1.5">
      <Meter
        value={used}
        min={0}
        max={limit}
        getAriaValueText={() => spoken}
        className="gap-y-1.5 **:data-[slot=meter-track]:h-1"
      >
        <MeterLabel className="font-normal">{label}</MeterLabel>
        <MeterValue>{() => value}</MeterValue>
      </Meter>
      {hint && <span className="text-caption text-faint-foreground">{hint}</span>}
    </div>
  )
}
