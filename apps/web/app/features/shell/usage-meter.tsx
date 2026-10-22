import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { cn } from '@/lib/utils'
import { AllowanceMeter } from '@/ui/allowance-meter'

/**
 * The allowance that limits new analyses (23 §5): Lite for Free ("4 of 5 Lite analyses left ·
 * resets 1 Dec"), full analyses for Plus (Lite has no cap there).
 */
export function UsageMeter({ me, className }: { me: MeData; className?: string }) {
  const plus = me.plan !== 'free'
  const { cap, used, resets_at } = plus ? me.usage.full : me.usage.lite
  if (cap === null) return null
  const left = Math.max(0, cap - used)
  const values = {
    left: String(left),
    limit: String(cap),
    date: resets_at ? formatDate(new Date(resets_at)) : '',
  }
  const text = plus ? m['billing.full_allowance'](values) : m['plan.allowance'](values)
  return <AllowanceMeter left={left} limit={cap} text={text} className={cn(className)} />
}
