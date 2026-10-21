import type { AnalysisType } from '@splitune/contracts'
import type { z } from 'zod'
import { formatDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import type { MeData } from '@/lib/session'
import { RadioCard, RadioCardGroup } from '@/ui/radio-card'
import { InlineError } from '@/ui/status-message'
import { OptionSelect } from '../common/option-select'

export type AnalysisKind = z.infer<typeof AnalysisType>

/** What this account can start now (23 §5); real allowances and the upgrade path are step 14. */
export function analysisAvailability(me: MeData) {
  const full = me.entitlements.includes('analysis.full') || me.usage.welcome_available
  const { cap, used, resets_at } = me.usage.lite
  const lite = cap === null || used < cap
  return {
    full,
    lite,
    liteCap: cap,
    liteLeft: cap === null ? undefined : Math.max(0, cap - used),
    resetsAt: resets_at,
  }
}

// "Your part" and the Full / Lite choice (27 §3.6), shared by the File, Link and Record tabs.
export function AnalysisChoice({
  me,
  instrument,
  onInstrumentChange,
  type,
  onTypeChange,
}: {
  me: MeData
  instrument: InstrumentName
  onInstrumentChange: (instrument: InstrumentName) => void
  type: AnalysisKind
  onTypeChange: (type: AnalysisKind) => void
}) {
  const available = analysisAvailability(me)
  const resets = available.resetsAt ? formatDate(new Date(available.resetsAt)) : ''
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
            meta={me.usage.welcome_available ? m['plan.welcome_available']() : undefined}
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
        {!available.full && <InlineError tone="info" title={m['plan.cap_full']()} />}
        {!available.lite && (
          <InlineError
            tone="info"
            title={m['plan.cap_lite']({ limit: String(available.liteCap ?? ''), date: resets })}
          />
        )}
      </fieldset>
    </div>
  )
}
