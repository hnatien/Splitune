import { VideoIcon } from 'lucide-react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { track } from '@/lib/track'
import { ConfidenceLegendPopover } from '@/ui/confidence-legend'
import { Toggle } from '@/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import type { PracticeLayout } from './layout'
import { useShownView } from './notation-pane'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'
import { useVideoUrl } from './video-url'

// The status bar's own controls, loaded on demand (12 §10 route budget): the transcription chip
// (its legend and "Show uncertainty" in a popover, 26 §5), the Tab / Chords view, and the video
// toggle when the import has one.
export function StatusControls({ layout }: { layout: PracticeLayout }) {
  const { layers } = usePractice()
  const video = useVideoUrl()
  const videoOpen = usePracticeUi((s) => s.videoOpen)
  return (
    <>
      {(layers.chords || layers.tab || layers.roll) && <Legend />}
      {layers.chords && (layers.tab || layers.roll) && <ViewSwitch layout={layout} />}
      {video.data && (
        <Toggle
          variant="default"
          size="practice-2"
          className="px-0"
          pressed={videoOpen}
          onPressedChange={(open) => usePracticeUi.setState({ videoOpen: open })}
          aria-label={m['practice.video']()}
        >
          <VideoIcon aria-hidden className="size-6" />
        </Toggle>
      )}
    </>
  )
}

// "Auto-transcribed · v0.4.0" (26 §5): a dashed chip, like the marks it explains; the legend and
// the "Show uncertainty" switch open from it. Narrow bars keep its icon.
function Legend() {
  const { data } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const update = usePracticeDefaults((s) => s.update)
  // The legend names the transcription's model version.
  const model =
    data.notes.data?.models[0]?.version ??
    data.chords.data?.models[0]?.version ??
    data.analysis.data?.pipeline_version ??
    ''
  return (
    <ConfidenceLegendPopover
      buttonLabel={m['practice.legend_short']({ model })}
      text={m['practice.legend']({ model })}
      labels={{
        showUncertainty: m['practice.show_uncertainty'](),
        medium: m['practice.probably'](),
        low: m['practice.unsure'](),
      }}
      showUncertainty={showUncertainty}
      onShowUncertaintyChange={(show) => update({ showUncertainty: show })}
    />
  )
}

// Tab / Chords (the chord sheet; the glance view on phone portrait); piano's Chart / Notes / Staff
// (the chord chart, the falling notes, the grand staff). Choosing Tab, Notes or Staff over a
// chords-only recommendation is the banner's "Show tab anyway".
function ViewSwitch({ layout }: { layout: PracticeLayout }) {
  const shown = useShownView(layout)
  const chosen = usePracticeUi((s) => s.view)
  const { layers } = usePractice()
  const piano = layers.roll
  const item = (value: string, label: string) => (
    <ToggleGroupItem key={value} value={value} className="px-4 text-sm">
      {label}
    </ToggleGroupItem>
  )
  return (
    <ToggleGroup
      aria-label={m['practice.view']()}
      value={[piano && shown === 'tab' && chosen === 'staff' ? 'staff' : shown]}
      onValueChange={(next) => {
        const view = next[0]
        if (view === 'tab' || view === 'staff') {
          usePracticeUi.setState({ view, forceTab: true })
          track('view_changed', { view: view === 'staff' ? 'staff' : piano ? 'notes' : 'tab' })
        } else if (view === 'chords') {
          usePracticeUi.setState({ view: 'chords' })
          track('view_changed', { view: layout === 'phone-portrait' ? 'glance' : 'chords' })
        }
      }}
    >
      {piano
        ? [
            item('chords', m['practice.view_chart']()),
            item('tab', m['practice.view_notes']()),
            item('staff', m['practice.view_staff']()),
          ]
        : [item('tab', m['practice.view_tab']()), item('chords', m['practice.view_chords']())]}
    </ToggleGroup>
  )
}
