import { lazy, Suspense, useState } from 'react'
import { client } from '@/lib/api'
import { useDisplay } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
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
// "Re-create stems", the once-only "Is this your guitar?" audition when stems arrive, and the
// evening "Practising in the dark? Try Stage" hint (26 §2), and once per device, where the screen
// can't be kept on, the "Keep screen on" tip from the first play (24 §3).

const WrongInstrument = lazy(() =>
  import('./wrong-instrument').then((module) => ({ default: module.WrongInstrument })),
)

const AUDITION_KEY = 'splitune.audition'
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
  const [, rerender] = useState(0)
  const failures = analysisFailures(data).filter(isFallback)
  const songId = data.song.data?.id ?? ''
  const reason = recommended.reasons.find((r) => r in VIEW_REASON)
  // Example songs are Splitune's own, already checked: no "Is this your guitar?".
  const auditionPending =
    layers.stems &&
    songId !== '' &&
    data.song.data?.source_kind !== 'example' &&
    !storedOnce(AUDITION_KEY, songId)
  const evening = new Date().getHours() >= 20
  const stageHint = evening && appearance !== 'stage' && !storedOnce(STAGE_HINT_KEY, 'shown')
  const played = state !== 'loading' && state !== 'ready'
  const screenTip = screenMayLock && played && !storedOnce(SCREEN_TIP_KEY, 'shown')
  const [wrongOpen, setWrongOpen] = useState(false)

  return (
    <>
      {recommended.chordsOnly && !forceTab && layers.tab && (
        <Banner
          tone="info"
          title={
            reason
              ? (VIEW_REASON[reason]?.() ?? m['practice.chords_only']())
              : m['practice.chords_only']()
          }
          actions={
            <Button
              variant="outline"
              onClick={() => {
                usePracticeUi.setState({ forceTab: true })
                track('view_changed', { view: 'tab' })
              }}
            >
              {m['practice.show_tab_anyway']()}
            </Button>
          }
        />
      )}
      {failures.map((failure) => (
        <Banner key={failure.stage} tone="warning" title={stageFailureMessage(failure)} />
      ))}
      {data.stemsExpired && <StemsExpired />}
      {auditionPending && data.song.data && (
        <Banner
          tone="info"
          title={m['analysis.wrong_instrument']({
            instrument: instrumentLabel(data.song.data.instrument).toLowerCase(),
          })}
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  rememberOnce(AUDITION_KEY, songId)
                  rerender((n) => n + 1)
                }}
              >
                {m['practice.audition_yes']()}
              </Button>
              <Button variant="ghost" onClick={() => setWrongOpen(true)}>
                {m['practice.audition_wrong']()}
              </Button>
            </>
          }
        />
      )}
      {stageHint && (
        <Banner
          tone="info"
          title={m['practice.stage_hint']()}
          actions={
            <Button
              variant="outline"
              onClick={() => {
                rememberOnce(STAGE_HINT_KEY, 'shown')
                update({ appearance: 'stage' })
              }}
            >
              {m['practice.try_stage']()}
            </Button>
          }
          dismiss={{
            label: m['system.close'](),
            onDismiss: () => {
              rememberOnce(STAGE_HINT_KEY, 'shown')
              rerender((n) => n + 1)
            },
          }}
        />
      )}
      {screenTip && (
        <Banner
          tone="info"
          title={m['practice.screen_tip']()}
          dismiss={{
            label: m['system.close'](),
            onDismiss: () => {
              rememberOnce(SCREEN_TIP_KEY, 'shown')
              rerender((n) => n + 1)
            },
          }}
        />
      )}
      {wrongOpen && data.song.data && (
        <Suspense fallback={null}>
          <WrongInstrument
            songId={songId}
            current={data.song.data.instrument}
            analysisType={data.analysis.data?.type === 'lite' ? 'lite' : 'full'}
            onClose={() => {
              setWrongOpen(false)
              rememberOnce(AUDITION_KEY, songId)
            }}
          />
        </Suspense>
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
