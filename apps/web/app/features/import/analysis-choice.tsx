import type { AnalysisType } from '@splitune/contracts'
import type { z } from 'zod'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import type { MeData } from '@/lib/session'
import { Button } from '@/ui/button'
import { RadioCard, RadioCardGroup } from '@/ui/radio-card'
import { InlineError } from '@/ui/status-message'
import type { Trigger } from '../billing/plans'
import { OptionSelect } from '../common/option-select'

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

// "Your part" and the Full / Lite choice (27 §3.6), shared by the File, Link and Record tabs. A used
// up allowance is a lock right here, where the learner acts (23 §5), with the way to Plus.
export function AnalysisChoice({
  me,
  instrument,
  onInstrumentChange,
  type,
  onTypeChange,
  onSeePlus,
}: {
  me: MeData
  instrument: InstrumentName
  onInstrumentChange: (instrument: InstrumentName) => void
  type: AnalysisKind
  onTypeChange: (type: AnalysisKind) => void
  onSeePlus: (trigger: Trigger) => void
}) {
  const available = analysisAvailability(me)
  const date = (iso: string | null) => (iso ? formatDate(new Date(iso)) : '')
  const resets = date(available.resetsAt)
  const seePlus = (trigger: Trigger) =>
    !available.plus && (
      <Button variant="outline" onClick={() => onSeePlus(trigger)}>
        {m['plan.see_plus']()}
      </Button>
    )
  return (
    <div className="flex flex-col gap-5">
      <OptionSelect
        label={m['import.your_part']()}
        value={instrument}
        options={INSTRUMENTS.map((value) => ({ value, label: instrumentLabel(value) }))}
        onChange={onInstrumentChange}
        className="w-full sm:w-64"
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">{m['import.analysis_label']()}</legend>
        <RadioCardGroup
          value={type}
          onValueChange={(value) => onTypeChange(value as AnalysisKind)}
          className="lg:grid-cols-1"
        >
          <RadioCard
            value="full"
            title={m['import.full_title']()}
            description={m['import.full_body']()}
            disabled={!available.full}
          />
          <RadioCard
            value="lite"
            title={m['import.lite_title']()}
            description={m['import.lite_body']()}
            disabled={!available.lite}
            meta={
              available.liteCap !== null && available.liteLeft !== undefined
                ? m['plan.allowance']({
                    left: String(available.liteLeft),
                    limit: String(available.liteCap),
                    date: resets,
                  })
                : undefined
            }
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
    </div>
  )
}
