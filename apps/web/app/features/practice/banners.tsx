import { useState } from 'react'
import { client } from '@/lib/api'
import { m } from '@/lib/i18n'
import { isFallback, type StageFailure, stageFailureMessage } from '@/lib/reasons'
import { track } from '@/lib/track'
import { useOnline } from '@/lib/use-online'
import { Button } from '@/ui/button'
import { Banner } from '@/ui/status-message'
import { analysisFailures } from './analysis-status'
import { useRecommendedView, useScreen } from './notation-pane'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// Practice banners (27 §3.7.3, §3.11, §5.6), each one quiet line above the music (a glyph, the
// words and at most one everyday button, never a tinted bar, and never a second filled control
// beside Play): the chords-only
// fallback with "Show tab anyway", the rough-part banner ("Your part didn't separate cleanly, so
// the tab may be rougher." · Show chords instead), stage fallbacks ("Stems are unavailable right
// now…"; for separation, what's ready in plain words with Try again), stems removed after 180 days unused with "Re-create stems", "Playback paused by another
// app or a call." with Tap to resume, the audio that couldn't load, and once per device, where the
// screen can't be kept on, the screen tip from the first play (24 §3). The evening "Try Stage" hint
// is retired (26 §2): Dark is already the default.

const SCREEN_TIP_KEY = 'splitune.screen-tip'
// Closed for this page only: it comes back with the next visit while the part is still rough.
const ROUGH_KEY = 'rough-part'

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
  const { data, state, player, togglePlay, audioStatus, channels, layers } = usePractice()
  // The banner's rules don't depend on the layout.
  const { banner, notationEvent, shown } = useScreen('desktop')
  const screenMayLock = usePracticeUi((s) => s.screenMayLock)
  const recommended = useRecommendedView()
  const online = useOnline()
  // Closed on this page even where storage is blocked; storage only remembers it for next time.
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set())
  const close = (key: string) => {
    if (key === SCREEN_TIP_KEY) rememberOnce(key, 'shown')
    setClosed((current) => new Set(current).add(key))
  }
  const failures = analysisFailures(data).filter(isFallback)
  const reason = recommended.reasons.find((r) => r in VIEW_REASON)
  // The part came out rough but the tab still shows: say so, with the chords one tap away.
  const roughPart =
    channels.some((c) => c.role === 'part' && c.rough) &&
    layers.tab &&
    shown === 'tab' &&
    banner === null &&
    !closed.has(ROUGH_KEY)
  const played = state !== 'loading' && state !== 'ready'
  const screenTip =
    screenMayLock && played && !closed.has(SCREEN_TIP_KEY) && !storedOnce(SCREEN_TIP_KEY, 'shown')

  return (
    <>
      {banner?.kind === 'unsure' && <Banner tone="info" title={m['practice.notes_unsure']()} />}
      {banner?.kind === 'held' && (
        <Banner
          tone="info"
          title={
            banner.title === 'piano'
              ? m['practice.chords_only_piano']()
              : banner.title === 'vocals'
                ? m['practice.chords_only_vocals']()
                : reason
                  ? (VIEW_REASON[reason]?.() ?? m['practice.chords_only']())
                  : m['practice.chords_only']()
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                usePracticeUi.setState({ forceTab: true })
                track('view_changed', { view: notationEvent })
              }}
            >
              {banner.notes ? m['practice.show_notes_anyway']() : m['practice.show_tab_anyway']()}
            </Button>
          }
        />
      )}
      {failures.map((failure) =>
        stemsFailed(failure) ? (
          <StemsUnavailable key={failure.stage} />
        ) : (
          <Banner key={failure.stage} tone="warning" title={stageFailureMessage(failure)} />
        ),
      )}
      {data.stemsExpired && <StemsExpired />}
      {roughPart && (
        <Banner
          tone="warning"
          title={m['practice.rough_part']()}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                usePracticeUi.setState({ view: 'chords', forceTab: false })
                track('view_changed', { view: 'chords' })
              }}
            >
              {m['practice.show_chords_instead']()}
            </Button>
          }
          dismiss={{ label: m['system.close'](), onDismiss: () => close(ROUGH_KEY) }}
        />
      )}
      {player.interrupted && (
        <Banner
          tone="info"
          title={m['practice.interrupted']()}
          actions={
            <Button variant="outline" size="sm" onClick={() => togglePlay()}>
              {m['practice.tap_to_resume']()}
            </Button>
          }
        />
      )}
      {audioStatus === 'failed' && (
        <Banner
          tone="warning"
          title={online ? m['practice.audio_failed']() : m['practice.not_offline']()}
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

// Separation failed and the pipeline went on without stems (06 §6), the case reasons.ts names
// stems_unavailable.
const stemsFailed = ({ stage, fallback }: StageFailure) =>
  fallback === 'stems_unavailable' ||
  (fallback === undefined && (stage === 'separate' || stage === 'stem_post'))

// A re-run of the analysis re-creates the stems; it uses no allowance (the API's rerun).
function Rerun({ label }: { label: string }) {
  const { data } = usePractice()
  const [busy, setBusy] = useState(false)
  const analysisId = data.analysis.data?.id
  if (!analysisId) return null
  return (
    <Button
      variant="outline"
      size="sm"
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
      {label}
    </Button>
  )
}

function StemsUnavailable() {
  return (
    <Banner
      tone="warning"
      title={m['practice.stems_unavailable']()}
      actions={<Rerun label={m['common.try_again']()} />}
    />
  )
}

function StemsExpired() {
  return (
    <Banner
      tone="info"
      title={m['practice.stems_expired']()}
      actions={<Rerun label={m['library.recreate_stems']()} />}
    />
  )
}
