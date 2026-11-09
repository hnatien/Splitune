import { useQuery } from '@tanstack/react-query'
import { PIANO_HANDS, usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { track } from '@/lib/track'
import { Badge } from '@/ui/badge'
import { ConfidenceLegendPopover } from '@/ui/confidence-legend'
import { Spinner } from '@/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { statsQuery } from '../library/queries'
import { handsLabel } from './display-options'
import { isPhone, type PracticeLayout } from './layout'
import { analysingStep, etaMinutes, oneInBand, remaining, running } from './model/getting-ready'
import type { Screen, ViewLabel } from './model/screen'
import { unsureSpots } from './model/view-model'
import { useScreen } from './notation-pane'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The top bar's own controls, loaded on demand (12 §10 route budget): in the centre the view
// switch (27 §3.7.5; piano adds Hands on desktop), or while the analysis runs the analysing badge
// "Analysing 5 of 8 · about 4 min left" (27 §3.7.3); and the legend chip (26 §5).

export function StatusControls({ layout }: { layout: PracticeLayout }) {
  const screen = useScreen(layout)
  const { data, layers } = usePractice()
  const analysing = running(data.analysis.data) && !layers.tab && !layers.roll && !layers.drums
  return (
    <>
      {analysing ? (
        <AnalysingBadge />
      ) : (
        screen.viewSwitch && (
          <ViewSwitch
            viewSwitch={screen.viewSwitch}
            notationEvent={screen.notationEvent}
            layout={layout}
          />
        )
      )}
      {layout === 'desktop' && data.instrument === 'piano' && layers.roll && <PianoHands />}
    </>
  )
}

// The primary badge with a spinner (27 §3.7.3): the stage being worked on of all, and the ETA
// when every remaining stage has a typical time.
function AnalysingBadge() {
  const { data } = usePractice()
  const stats = useQuery(statsQuery)
  const analysis = data.analysis.data
  if (!analysis) return null
  const step = analysingStep(analysis)
  const minutes = etaMinutes(remaining(analysis, stats.data?.stages ?? []))
  return (
    <Badge variant="primary" className="h-7 gap-2 px-3 text-xs whitespace-nowrap">
      <Spinner className="size-3" />
      {m['practice.analysing_badge']({ done: String(step.current), total: String(step.total) })}
      {minutes && ` · ${m['analysis.eta_inline']({ minutes })}`}
    </Badge>
  )
}

/** "? Auto-transcribed · 6 unsure" and its popover (26 §5), once there's something transcribed. */
export function StatusLegend() {
  const { data, view, layers } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const update = usePracticeDefaults((s) => s.update)
  if (!layers.chords && !layers.tab && !layers.roll && !layers.melody && !layers.drums) return null
  // The legend names the transcription's model version.
  const model =
    data.notes.data?.models[0]?.version ??
    data.chords.data?.models[0]?.version ??
    data.analysis.data?.pipeline_version ??
    ''
  const spots = unsureSpots(view)
  const band = oneInBand(spots.noteShare)
  return (
    <ConfidenceLegendPopover
      buttonLabel={
        spots.count > 0
          ? m['practice.legend_short']({ count: String(spots.count) })
          : m['practice.legend_short_none']()
      }
      text={m['practice.legend']({ model })}
      labels={{
        showUncertainty: m['practice.show_uncertainty'](),
        high: m['practice.sure'](),
        medium: m['practice.probably'](),
        low: m['practice.unsure'](),
        edited: m['practice.edited'](),
      }}
      frequency={band ? m['practice.legend_frequency']({ n: String(band) }) : undefined}
      showUncertainty={showUncertainty}
      onShowUncertaintyChange={(show) => update({ showUncertainty: show })}
    />
  )
}

// Tab / Notes / Chords (the tab, the lanes onto the neck, the chord sheet; the glance view on phone
// portrait); piano's Chart / Notes / Staff (the chord chart, the falling notes, the grand staff);
// drums' Grid / Staff / Chords; vocals' Melody / Chords.
// Choosing a notation over a chords-only recommendation is the banner's "Show tab anyway";
// choosing the chords takes it back, so the banner returns and the chords are what's saved.
function ViewSwitch({
  viewSwitch,
  notationEvent,
  layout,
}: {
  viewSwitch: NonNullable<Screen['viewSwitch']>
  notationEvent: Screen['notationEvent']
  layout: PracticeLayout
}) {
  return (
    <ToggleGroup
      aria-label={m['practice.view']()}
      size={isPhone(layout) ? 'md' : 'practice-2'}
      value={[viewSwitch.selected]}
      onValueChange={(next) => {
        const view = next[0]
        if (view === 'tab' || view === 'staff' || view === 'notes') {
          usePracticeUi.setState({ view, forceTab: true })
          track('view_changed', { view: view === 'tab' ? notationEvent : view })
        } else if (view === 'chords') {
          usePracticeUi.setState({ view: 'chords', forceTab: false })
          track('view_changed', { view: layout === 'phone-portrait' ? 'glance' : 'chords' })
        }
      }}
    >
      {viewSwitch.items.map(({ value, label }) => (
        <ToggleGroupItem key={value} value={value}>
          {VIEW_LABEL[label]()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

// Piano's Hands (27 §3.7.5, Practice-Piano.dc.html): Both · Left · Right; the other hand is drawn
// at 45 %, the audio is unchanged.
function PianoHands() {
  const hands = usePracticeDefaults((s) => s.pianoHands)
  const update = usePracticeDefaults((s) => s.update)
  return (
    <ToggleGroup
      aria-label={m['practice.hands']()}
      size="practice-2"
      value={[hands]}
      onValueChange={(next) => {
        const picked = PIANO_HANDS.find((h) => h === next[0])
        if (picked) update({ pianoHands: picked })
      }}
    >
      {PIANO_HANDS.map((value) => (
        <ToggleGroupItem key={value} value={value}>
          {handsLabel(value)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

const VIEW_LABEL: Record<ViewLabel, () => string> = {
  tab: () => m['practice.view_tab'](),
  notes: () => m['practice.view_notes'](),
  staff: () => m['practice.view_staff'](),
  chords: () => m['practice.view_chords'](),
  chart: () => m['practice.view_chart'](),
  grid: () => m['practice.view_grid'](),
  melody: () => m['practice.view_melody'](),
}
