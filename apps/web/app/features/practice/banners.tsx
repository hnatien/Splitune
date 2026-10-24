import { useState } from 'react'
import { client } from '@/lib/api'
import { useDisplay } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { isFallback, stageFailureMessage } from '@/lib/reasons'
import { track } from '@/lib/track'
import { Button } from '@/ui/button'
import { Banner } from '@/ui/status-message'
import { analysisFailures } from './analysis-status'
import { useRecommendedView } from './notation-pane'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// Practice banners (27 §3.7.3, §5.6): the chords-only fallback with "Show tab anyway", stage
// fallbacks ("Stems are unavailable right now…"), stems removed after 180 days unused with
// "Re-create stems", the evening "Practising in the dark? Try Stage" hint (26 §2), and once per device, where the screen
// can't be kept on, the "Keep screen on" tip from the first play (24 §3).

const STAGE_HINT_KEY = 'splitune.stage-hint'
const SCREEN_TIP_KEY = 'splitune.screen-tip'

function storedOnce(key: string, id: string): boolean {
  try {
    return (localStorage.getItem(key) ?? '').split(',').includes(id)
  } catch {
    return false
  }
}

function rememberOnce(key: string, id: string) {
  try {
    const seen = (localStorage.getItem(key) ?? '').split(',').filter(Boolean)
    localStorage.setItem(key, [...seen, id].slice(-50).join(','))
  } catch {
    // Shown again next time.
  }
}

const VIEW_REASON: Record<string, () => string> = {
  notes_unavailable: () => m['practice.reason.notes_unavailable'](),
  notation_not_supported: () => m['practice.reason.notation_not_supported'](),
  rough_stem_low_conf: () => m['practice.reason.rough_stem_low_conf'](),
  low_confidence: () => m['practice.chords_only'](),
  quality_gate_failed: () => m['practice.chords_only'](),
}

export function PracticeBanners() {
  const { data, layers, state } = usePractice()
  const forceTab = usePracticeUi((s) => s.forceTab)
  const screenMayLock = usePracticeUi((s) => s.screenMayLock)
  const recommended = useRecommendedView()
  const appearance = useDisplay((s) => s.appearance)
  const update = useDisplay((s) => s.update)
  // Closed on this page even where storage is blocked; storage only remembers it for next time.
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set())
  const close = (key: string) => {
    rememberOnce(key, 'shown')
    setClosed((current) => new Set(current).add(key))
  }
  const failures = analysisFailures(data).filter(isFallback)
  const reason = recommended.reasons.find((r) => r in VIEW_REASON)
  const evening = new Date().getHours() >= 20
  const stageHint =
    evening &&
    appearance !== 'stage' &&
    !closed.has(STAGE_HINT_KEY) &&
    !storedOnce(STAGE_HINT_KEY, 'shown')
  const played = state !== 'loading' && state !== 'ready'
  const screenTip =
    screenMayLock && played && !closed.has(SCREEN_TIP_KEY) && !storedOnce(SCREEN_TIP_KEY, 'shown')

  return (
    <>
      {recommended.chordsOnly && !forceTab && (layers.tab || layers.roll || layers.melody) && (
        <Banner
          tone="info"
          title={
            layers.roll
              ? m['practice.chords_only_piano']()
              : layers.melody
                ? m['practice.chords_only_vocals']()
                : reason
                  ? (VIEW_REASON[reason]?.() ?? m['practice.chords_only']())
                  : m['practice.chords_only']()
          }
          actions={
            <Button
              variant="outline"
              onClick={() => {
                usePracticeUi.setState({ forceTab: true })
                track('view_changed', { view: layers.roll || layers.melody ? 'notes' : 'tab' })
              }}
            >
              {layers.roll || layers.melody
                ? m['practice.show_notes_anyway']()
                : m['practice.show_tab_anyway']()}
            </Button>
          }
        />
      )}
      {failures.map((failure) => (
        <Banner key={failure.stage} tone="warning" title={stageFailureMessage(failure)} />
      ))}
      {data.stemsExpired && <StemsExpired />}
      {stageHint && (
        <Banner
          tone="info"
          title={m['practice.stage_hint']()}
          actions={
            <Button
              variant="outline"
              onClick={() => {
                close(STAGE_HINT_KEY)
                update({ appearance: 'stage' })
              }}
            >
              {m['practice.try_stage']()}
            </Button>
          }
          dismiss={{ label: m['system.close'](), onDismiss: () => close(STAGE_HINT_KEY) }}
        />
      )}
      {screenTip && (
        <Banner
          tone="info"
          title={m['practice.screen_tip']()}
          dismiss={{ label: m['system.close'](), onDismiss: () => close(SCREEN_TIP_KEY) }}
        />
      )}
    </>
  )
}

// A re-run of the analysis re-creates the stems; it uses no allowance (the API's rerun).
function StemsExpired() {
  const { data } = usePractice()
  const [busy, setBusy] = useState(false)
  const analysisId = data.analysis.data?.id
  return (
    <Banner
      tone="info"
      title={m['practice.stems_expired']()}
      actions={
        analysisId && (
          <Button
            variant="outline"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await client.analyses.rerun({ id: analysisId })
                await data.song.refetch()
              } finally {
                setBusy(false)
              }
            }}
          >
            {m['library.recreate_stems']()}
          </Button>
        )
      }
    />
  )
}
