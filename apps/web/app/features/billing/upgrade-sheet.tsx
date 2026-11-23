import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CheckIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { analytics } from '@/lib/analytics'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/ui/drawer'
import { Skeleton } from '@/ui/skeleton'
import { InlineError } from '@/ui/status-message'
import {
  checkoutUrl,
  DEFAULT_PLAN,
  type PaidPlanName,
  PlanChoice,
  plansQuery,
  type Trigger,
} from './plans'

// Upgrade sheet (27 §3.10): opened from a lock at a point of action (23 §5). What Plus adds, the
// monthly and yearly prices as equal choice rows (monthly chosen), "Cancel anytime in one tap",
// then Continue to checkout as the one filled control with "Not now" after it, never between the
// choice and the action. A dialog with a close button on wide screens and a bottom sheet on
// phones (s47 direction §6). If the prices don't load, the benefits stay, the failure is said in
// place of the choice with Try again, and Continue says it is unavailable and why.

function PlusBenefits({ fullPerPeriod }: { fullPerPeriod?: number | undefined }) {
  const items = [
    ...(fullPerPeriod === undefined ? [] : [m['plan.plus_full']({ limit: String(fullPerPeriod) })]),
    m['plan.plus_lite'](),
    m['plan.plus_extra'](),
    m['plan.plus_priority'](),
    m['plan.plus_depth'](),
  ]
  return (
    <ul className="flex list-none flex-col gap-2.5 p-0">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-body">
          <CheckIcon aria-hidden strokeWidth={1.8} className="mt-0.5 size-4.5 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function UpgradeSheet({
  open,
  onClose,
  trigger,
  returnPath,
}: {
  open: boolean
  onClose: () => void
  trigger: Trigger
  /** Where a cancelled checkout comes back to. */
  returnPath: string
}) {
  const plans = useQuery({ ...plansQuery, enabled: open })
  const [plan, setPlan] = useState<PaidPlanName>(DEFAULT_PLAN)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const navigate = useNavigate()
  const wide = useMediaQuery('(min-width: 640px)')

  useEffect(() => {
    if (open) analytics.track('paywall_viewed', { trigger })
  }, [open, trigger])

  const proceed = async () => {
    setPending(true)
    setFailed(false)
    try {
      await navigate({ href: await checkoutUrl(plan, trigger, returnPath) })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  const body = (
    <div className="flex flex-col gap-6">
      <PlusBenefits fullPerPeriod={plans.data?.allowances.plus_full_per_period} />
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        {plans.data ? (
          <PlanChoice plans={plans.data.plans} value={plan} onChange={setPlan} />
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
          <div className="flex flex-col gap-2" aria-hidden>
            <Skeleton className="h-14 rounded-field" />
            <Skeleton className="h-14 rounded-field" />
          </div>
        )}
        <p className="text-body-sm text-muted-foreground">{m['plan.cancel_anytime']()}</p>
      </div>
      {failed && <InlineError title={m['billing.action_failed']()} />}
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!plans.data}
          {...(plans.isError ? { unavailableLabel: m['plan.prices_unavailable']() } : {})}
          loading={pending}
          onClick={proceed}
        >
          {m['plan.continue_checkout']()}
        </Button>
        <Button variant="quiet" size="lg" block onClick={onClose}>
          {m['plan.not_now']()}
        </Button>
      </div>
    </div>
  )

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent closeLabel={m['system.close']()} className="gap-6">
          <DialogHeader>
            <DialogTitle>{m['plan.plus_gives']()}</DialogTitle>
            <DialogDescription>{m['plan.free_stays']()}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} swipeDirection="down">
      <DrawerContent>
        <div className="flex flex-col overflow-y-auto">
          <div className="flex items-start gap-2 pr-3">
            <DrawerHeader className="flex-1 group-data-[swipe-axis=y]/drawer-popup:text-left">
              <DrawerTitle>{m['plan.plus_gives']()}</DrawerTitle>
              <DrawerDescription>{m['plan.free_stays']()}</DrawerDescription>
            </DrawerHeader>
            <DrawerClose
              aria-label={m['system.close']()}
              render={<Button variant="quiet" size="icon" className="mt-3" />}
            >
              <XIcon aria-hidden />
            </DrawerClose>
          </div>
          <div className="px-6 pt-6 pb-6">{body}</div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
