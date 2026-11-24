import type { AnalysisType } from '@splitune/contracts'
import { useId } from 'react'
import type { z } from 'zod'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { Button } from '@/ui/button'
import { ChoiceRow, ChoiceRowGroup } from '@/ui/choice-row'
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

// The Full / Lite choice (27 §3.6), shared by the File, Link and Record tabs: two choice rows
// (26 §12.1), each with what it gives and, at its end, the Welcome note or what is left. A used-up
// allowance says "Unavailable" on its row and explains itself right under the rows, where the
// learner acts (23 §5), with the way to Plus.
export function AnalysisChoice({
  me,
  type,
  onTypeChange,
  onSeePlus,
  groupId,
}: {
  me: MeData
  type: AnalysisKind
  onTypeChange: (type: AnalysisKind) => void
  onSeePlus: (trigger: Trigger) => void
  /** The radio group's id, so a submit with no allowance left can move focus here. */
  groupId?: string
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
    <div data-analysis className="flex min-w-0 flex-col gap-2">
      <span id={legend} className="flex min-h-target items-center text-label">
        {m['import.analysis_label']()}
      </span>
      <ChoiceRowGroup
        id={groupId}
        aria-labelledby={legend}
        value={type}
        onValueChange={(value) => onTypeChange(value as AnalysisKind)}
      >
        <ChoiceRow
          value="full"
          disabled={!available.full}
          label={m['import.full_title']()}
          description={m['import.full_body']()}
          trailing={
            <Note>
              {!available.full
                ? m['import.unavailable']()
                : welcome
                  ? m['import.welcome_badge']()
                  : undefined}
            </Note>
          }
        />
        <ChoiceRow
          value="lite"
          disabled={!available.lite}
          label={m['import.lite_title']()}
          description={m['import.lite_body']()}
          trailing={
            <Note>
              {!available.lite
                ? m['import.unavailable']()
                : liteLeft && m['import.left_badge'](liteLeft)}
            </Note>
          }
        />
      </ChoiceRowGroup>
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

/** What a row's choice costs or why it can't be chosen, at its end. */
function Note({ children }: { children: string | undefined }) {
  if (!children) return null
  return (
    <span className="shrink-0 text-right text-label-sm text-muted-foreground tabular-nums">
      {children}
    </span>
  )
}
