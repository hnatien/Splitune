import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { analytics } from '@/lib/analytics'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
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

// Upgrade sheet (27 §3.10): opened from a lock at a point of action (23 §5). What Plus adds in one
// screen, monthly and yearly prices with no default emphasis, "Cancel anytime in one tap", and
// Continue to checkout.

export function PlusBenefits({ fullPerPeriod }: { fullPerPeriod: number }) {
  const items = [
    m['plan.plus_full']({ limit: String(fullPerPeriod) }),
    m['plan.plus_lite'](),
    m['plan.plus_extra'](),
    m['plan.plus_priority'](),
    m['plan.plus_depth'](),
  ]
  return (
    <ul className="flex list-none flex-col gap-2 p-0">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-base">
          <CheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
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

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} swipeDirection="down">
      <DrawerContent>
        <div className="mx-auto flex w-full max-w-md flex-col overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{m['plan.plus_gives']()}</DrawerTitle>
            <DrawerDescription>{m['plan.free_stays']()}</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-5 px-6 pt-4 pb-2">
            {plans.data ? (
              <>
                <PlusBenefits fullPerPeriod={plans.data.allowances.plus_full_per_period} />
                <PlanChoice
                  plans={plans.data.plans}
                  value={plan}
                  onChange={setPlan}
                  className="grid-cols-2"
                />
                <p className="text-sm text-muted-foreground">{m['plan.cancel_anytime']()}</p>
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
                <Skeleton className="h-28" />
                <Skeleton className="h-20" />
              </div>
            )}
            {failed && <InlineError title={m['billing.action_failed']()} />}
          </div>
          <DrawerFooter>
            <Button variant="ghost" onClick={onClose}>
              {m['plan.not_now']()}
            </Button>
            <Button variant="primary" disabled={!plans.data} loading={pending} onClick={proceed}>
              {m['plan.continue_checkout']()}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
