import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { useState } from 'react'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { Button, buttonVariants } from '@/ui/button'
import { Meter, MeterLabel, MeterValue } from '@/ui/meter'
import { Popover } from '@/ui/popover'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { CANCELLED_PATH } from '../billing/billing-settings'
import { periodLine, planName } from '../billing/plans'
import { UpgradeSheet } from '../billing/upgrade-sheet'
import { usageItems, usedText } from '../settings/usage-settings'

// Usage (the account menu's Usage row): what this period's allowances have used, one row each
// ("Lite analyses … 1 of 5 used", a bar, "Resets 1 Dec"), then the plan with View plan and, on
// Free, See Plus. Settings → Usage and Plan hold the full pages. It opens from the account control
// (beside the rail, under the top bar) and hands focus back to it when it closes.
export function UsagePopover({
  me: initial,
  anchor,
  side,
  open,
  onOpenChange,
}: {
  me: MeData
  anchor: React.RefObject<HTMLElement | null>
  side: 'right' | 'bottom'
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const me = useQuery({ ...meQuery, initialData: initial }).data ?? initial
  const [upgrading, setUpgrading] = useState(false)
  const plus = me.plan !== 'free' && me.subscription !== null
  const close = () => onOpenChange(false)

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverContent
          anchor={anchor}
          finalFocus={anchor}
          side={side}
          align="end"
          sideOffset={8}
          className="gap-0 p-0"
        >
          <div className="flex flex-col gap-4 p-4">
            <PopoverTitle className="text-title">{m['settings.usage_limits']()}</PopoverTitle>
            {usageItems(me).map((item) =>
              'limit' in item ? (
                <UsageBar key={item.id} {...item} />
              ) : (
                <div key={item.id} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-label">{item.label}</span>
                    <span className="text-right text-body-sm text-muted-foreground">
                      {item.note}
                    </span>
                  </div>
                  {item.hint && (
                    <span className="text-caption text-muted-foreground">{item.hint}</span>
                  )}
                </div>
              ),
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border p-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-label">
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
                className={buttonVariants({ variant: 'quiet', size: 'sm' })}
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

/** "Lite analyses … 1 of 5 used" over the bar, the reset date under it. */
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
      <Meter value={used} min={0} max={limit} getAriaValueText={() => spoken}>
        <MeterLabel className="text-label">{label}</MeterLabel>
        <MeterValue>{() => value}</MeterValue>
      </Meter>
      {hint && <span className="text-caption text-muted-foreground">{hint}</span>}
    </div>
  )
}
