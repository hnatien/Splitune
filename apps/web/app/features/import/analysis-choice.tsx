import type { AnalysisType } from '@splitune/contracts'
import { useId } from 'react'
import type { z } from 'zod'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { InlineError } from '@/ui/status-message'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import type { Trigger } from '../billing/plans'
import { CardRadio, CardRadioGroup } from './card-radio'

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

// The Full / Lite choice (27 §3.6), shared by the File, Link and Record tabs: radio cards with the
// Welcome and allowance badges, a two-item segmented control on phones. A used-up allowance is a
// lock right here, where the learner acts (23 §5), with the way to Plus.
export function AnalysisChoice({
  me,
  type,
  onTypeChange,
  onSeePlus,
  compact,
}: {
  me: MeData
  type: AnalysisKind
  onTypeChange: (type: AnalysisKind) => void
  onSeePlus: (trigger: Trigger) => void
  compact: boolean
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
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend id={legend} className="mb-2 text-sm font-semibold text-muted-foreground">
        {m['import.analysis_label']()}
      </legend>
      {compact ? (
        <ToggleGroup
          aria-labelledby={legend}
          value={[type]}
          onValueChange={(value) => {
            const next = value[0] as AnalysisKind | undefined
            if (next) onTypeChange(next)
          }}
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem value="full" disabled={!available.full}>
            {welcome ? m['import.full_free_once']() : m['import.full_title']()}
          </ToggleGroupItem>
          <ToggleGroupItem value="lite" disabled={!available.lite}>
            {liteLeft ? m['import.lite_left'](liteLeft) : m['import.lite_title']()}
          </ToggleGroupItem>
        </ToggleGroup>
      ) : (
        <CardRadioGroup
          aria-labelledby={legend}
          value={type}
          onValueChange={(value) => onTypeChange(value as AnalysisKind)}
        >
          <CardRadio value="full" disabled={!available.full} className="items-start">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-[650]">{m['import.full_title']()}</span>
              <span className="text-sm text-muted-foreground">{m['import.full_body']()}</span>
            </span>
            {welcome && <Badge variant="primary">{m['import.welcome_badge']()}</Badge>}
          </CardRadio>
          <CardRadio value="lite" disabled={!available.lite} className="items-start">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-[650]">{m['import.lite_title']()}</span>
              <span className="text-sm text-faint-foreground">{m['import.lite_body']()}</span>
            </span>
            {liteLeft && <Badge>{m['import.left_badge'](liteLeft)}</Badge>}
          </CardRadio>
        </CardRadioGroup>
      )}
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
                  <Button variant="ghost" onClick={() => onTypeChange('lite')}>
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
    </fieldset>
  )
}
