import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { cn } from '@/lib/utils'
import { AllowanceMeter } from '@/ui/allowance-meter'

/** Lite allowance (23 §5); hidden for plans without a Lite cap. Real numbers arrive in step 14. */
export function UsageMeter({ me, className }: { me: MeData; className?: string }) {
  const { cap, used, resets_at } = me.usage.lite
  if (cap === null) return null
  const left = Math.max(0, cap - used)
  const text = m['plan.allowance']({
    left: String(left),
    limit: String(cap),
    date: resets_at ? formatDate(new Date(resets_at)) : '',
  })
  return <AllowanceMeter left={left} limit={cap} text={text} className={cn(className)} />
}
