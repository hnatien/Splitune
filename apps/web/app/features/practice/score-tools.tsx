import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { ConfidenceLegend } from '@/ui/confidence-legend'
import { LevelToggle } from './level-toggle'
import { usePractice } from './practice-context'

// Level and capo, and the legend where the chord strip has no room for it.
export function ScoreTools() {
  const { data } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const update = usePracticeDefaults((s) => s.update)
  const model = data.notes.data?.models[0]?.version ?? data.analysis.data?.pipeline_version ?? ''
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2 in-data-[appearance=stage]:hidden">
      <LevelToggle />
      <ConfidenceLegend
        className="lg:hidden"
        text={m['practice.legend']({ model })}
        labels={{
          showUncertainty: m['practice.show_uncertainty'](),
          medium: m['practice.probably'](),
          low: m['practice.unsure'](),
        }}
        showUncertainty={showUncertainty}
        onShowUncertaintyChange={(show) => update({ showUncertainty: show })}
      />
    </div>
  )
}
