import type { AnalysisType } from '@splitune/contracts'
import { useId } from 'react'
import type { z } from 'zod'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { RadioCard, RadioCardGroup } from '@/ui/radio-card'
import { InlineError } from '@/ui/status-message'
import type { Trigger } from '../billing/plans'

export type AnalysisKind = z.infer<typeof AnalysisType>

/** What this account can start now (23 §5): the Welcome analysis or Plus' full allowance, Lite. */
export function analysisAvailability(me: MeData) {
  const plus = me.plan !== 'free'
  const fullCap = me.usage.full.cap
  const full = plus ? fullCap === null || me.usage.full.used < fullCap : me.usage.welcome_available
  const { cap, used, resets_at } = me.usage.lite
  const lite = cap === null || used < cap
  return {
    plus,
    full,
    fullCap,
    fullResetsAt: me.usage.full.resets_at,
    lite,
    liteCap: cap,
    liteLeft: cap === null ? undefined : Math.max(0, cap - used),
    resetsAt: resets_at,
  }
}

// The Full / Lite choice (27 §3.6), shared by the File, Link and Record tabs: two choice cards
// side by side (stacked on phones) with the Welcome and allowance badges. A used-up allowance is a
// lock right here, where the learner acts (23 §5), with the way to Plus.
export function AnalysisChoice({
  me,
  type,
  onTypeChange,
  onSeePlus,
}: {
  me: MeData
  type: AnalysisKind
  onTypeChange: (type: AnalysisKind) => void
  onSeePlus: (trigger: Trigger) => void
}) {
  const legend = useId()
  const available = analysisAvailability(me)
  const date = (iso: string | null) => (iso ? formatDate(new Date(iso)) : '')
  const resets = date(available.resetsAt)
  const welcome = !available.plus && me.usage.welcome_available
  const liteLeft =
    available.liteCap !== null && available.liteLeft !== undefined
      ? { left: String(available.liteLeft), limit: String(available.liteCap) }
      : undefined
  const seePlus = (trigger: Trigger) =>
    !available.plus && <Button onClick={() => onSeePlus(trigger)}>{m['plan.see_plus']()}</Button>
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={legend} className="flex min-h-target items-center text-label font-medium">
        {m['import.analysis_label']()}
      </span>
      <RadioCardGroup
        aria-labelledby={legend}
        value={type}
        onValueChange={(value) => onTypeChange(value as AnalysisKind)}
        className="gap-2"
      >
        <RadioCard
          value="full"
          disabled={!available.full}
          className="bg-transparent"
          title={m['import.full_title']()}
          description={m['import.full_body']()}
          meta={welcome && <Badge variant="primary">{m['import.welcome_badge']()}</Badge>}
        />
        <RadioCard
          value="lite"
          disabled={!available.lite}
          className="bg-transparent"
          title={m['import.lite_title']()}
          description={m['import.lite_body']()}
          meta={liteLeft && <Badge>{m['import.left_badge'](liteLeft)}</Badge>}
        />
      </RadioCardGroup>
      {!available.full && (
        <InlineError
          tone="info"
          title={
            available.plus
              ? m['plan.cap_full_plus']({
                  limit: String(available.fullCap ?? ''),
                  date: date(available.fullResetsAt),
                })
              : m['plan.cap_full']()
          }
          actions={
            (!available.plus || (available.lite && type === 'full')) && (
              <>
                {seePlus('cap_full')}
                {available.lite && type === 'full' && (
                  <Button variant="quiet" onClick={() => onTypeChange('lite')}>
                    {m['plan.use_lite']()}
                  </Button>
                )}
              </>
            )
          }
        />
      )}
      {!available.lite && (
        <InlineError
          tone="info"
          title={m['plan.cap_lite']({ limit: String(available.liteCap ?? ''), date: resets })}
          actions={seePlus('cap_lite')}
        />
      )}
    </div>
  )
}
