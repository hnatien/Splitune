import type * as React from 'react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { errorCode } from '@/lib/api'
import { m } from '@/lib/i18n'
import { apiErrorMessage } from '@/lib/reasons'
import { useOnline } from '@/lib/use-online'
import { Button } from '@/ui/button'
import { PedalHud } from '@/ui/pedal-hud'
import { Banner, InlineError } from '@/ui/status-message'
import { FocusShell } from '../shell/focus-shell'
import { ChordStrip } from './chord-strip'
import { useInputMapper } from './input-mapper'
import { isPhone, type PracticeLayout, usePracticeLayout } from './layout'
import { NotationPane, useShownView } from './notation-pane'
import {
  type FetchAudio,
  PracticeProvider,
  type PracticeSearch,
  usePractice,
} from './practice-context'
import { PracticeLoading } from './practice-loading'
import { usePracticeUi } from './practice-store'
import { PracticeTimeline } from './practice-timeline'
import { PracticeStatus } from './status-bar'
import { TransportBar } from './transport-bar'
import { useVideoUrl } from './video-url'

// Overlays load on first open, outside the route's JS budget (12 §10).
const MixerDrawer = lazy(() =>
  import('./mixer-drawer').then((module) => ({ default: module.MixerDrawer })),
)
const EditorSheet = lazy(() =>
  import('./editor-sheet').then((module) => ({ default: module.EditorSheet })),
)
const GlanceView = lazy(() =>
  import('./glance-view').then((module) => ({ default: module.GlanceView })),
)
const VideoPane = lazy(() =>
  import('./video-pane').then((module) => ({ default: module.VideoPane })),
)
// Banners render only once an artefact or a failure calls for one, so they load on demand too.
const PracticeBanners = lazy(() =>
  import('./banners').then((module) => ({ default: module.PracticeBanners })),
)
const ShortcutsOverlay = lazy(() =>
  import('./shortcuts-overlay').then((module) => ({ default: module.ShortcutsOverlay })),
)

/** True from the first time `open` is true, so an overlay keeps its closing animation. */
function useOpened(open: boolean): boolean {
  const [opened, setOpened] = useState(open)
  if (open && !opened) setOpened(true)
  return opened
}

// PracticeRoute (12 §2, 27 §3.7): the regions per layout around one provider. The page is exactly
// the viewport: the transport sits at the bottom edge and layers fill the flexible middle as
// artefacts land (27 §3.7.3), so nothing arriving ever moves the transport.

export function PracticePage({
  songId,
  search,
  guest = false,
  fetchAudio,
  children,
}: {
  songId: string
  search: PracticeSearch
  /** A visitor's example song (onboarding): exits to Home, no editor. */
  guest?: boolean
  fetchAudio?: FetchAudio
  /** Extra layers inside the practice screen (onboarding's coach marks and save sheet). */
  children?: React.ReactNode
}) {
  return (
    <PracticeProvider
      songId={songId}
      search={search}
      guest={guest}
      {...(fetchAudio ? { fetchAudio } : {})}
    >
      <PracticeScreen>{children}</PracticeScreen>
    </PracticeProvider>
  )
}

function PracticeScreen({ children }: { children?: React.ReactNode }) {
  const practice = usePractice()
  const layout = usePracticeLayout()
  const { song } = practice.data
  useInputMapper({ desktop: layout === 'desktop' })

  // The focus sink (12 §8): pedal keys reach the page, never a scroll container's defaults.
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [])

  if (song.isPending) return <PracticeLoading slowText={m['practice.loading']()} />
  if (song.isError) {
    return (
      <FocusShell exit={practice.guest}>
        <div className="mx-auto w-full max-w-page px-4 py-6">
          <InlineError title={apiErrorMessage(errorCode(song.error))} />
        </div>
      </FocusShell>
    )
  }
  return (
    <FocusShell fill exit={practice.guest} status={<PracticeStatus layout={layout} />}>
      {/* Notices sit in one slim stack above the paper; it takes no room when there are none. */}
      <div className="flex shrink-0 flex-col gap-2 px-4 py-2 empty:hidden md:px-6 [&>[data-slot=banner]]:py-1.5">
        <Suspense fallback={null}>
          <PracticeBanners />
        </Suspense>
        <Interrupted />
        <AudioProblem />
      </div>
      <Regions layout={layout} />
      <PracticeTimeline compact={layout === 'phone-landscape'} />
      <TransportBar layout={layout} />
      <Overlays layout={layout} />
      {children}
    </FocusShell>
  )
}

// The paper: the chord strip over the tab (or the chord sheet), or the glance view on phone
// portrait; a URL import's video floats over its corner when opened from the status bar. On phone
// landscape guitar's Notes take the strip's room and show its chord themselves.
function Regions({ layout }: { layout: PracticeLayout }) {
  const { layers } = usePractice()
  const shown = useShownView(layout)
  const view = usePracticeUi((s) => s.view)
  const notes = layout === 'phone-landscape' && view === 'notes'
  const videoOpen = usePracticeUi((s) => s.videoOpen)
  const video = useVideoUrl()
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {layout === 'phone-portrait' && shown === 'chords' ? (
        <Suspense fallback={null}>
          <GlanceView />
        </Suspense>
      ) : (
        <>
          {(layers.chords || layers.tab) && !(notes && shown === 'tab') && (
            <ChordStrip compact={isPhone(layout)} />
          )}
          <NotationPane compact={notes} />
        </>
      )}
      {video.data && videoOpen && (
        <Suspense fallback={null}>
          <VideoPane />
        </Suspense>
      )}
    </div>
  )
}

function Interrupted() {
  const { player, togglePlay } = usePractice()
  if (!player.interrupted) return null
  return (
    <Banner
      tone="info"
      title={m['practice.interrupted']()}
      actions={
        <Button variant="primary" onClick={() => togglePlay()}>
          {m['practice.tap_to_resume']()}
        </Button>
      }
    />
  )
}

// Offline, a song whose audio this device never stored can't play (27 §4).
function AudioProblem() {
  const { audioStatus } = usePractice()
  const online = useOnline()
  if (audioStatus !== 'failed') return null
  return (
    <Banner
      tone="warning"
      title={online ? m['practice.audio_failed']() : m['practice.not_offline']()}
    />
  )
}

function Overlays({ layout }: { layout: PracticeLayout }) {
  const hud = usePracticeUi((s) => s.hud)
  const mixer = useOpened(usePracticeUi((s) => s.mixerOpen))
  const editor = useOpened(usePracticeUi((s) => s.editor !== null))
  const shortcuts = useOpened(usePracticeUi((s) => s.shortcutsOpen))
  return (
    <>
      <Suspense fallback={null}>
        {mixer && <MixerDrawer phone={isPhone(layout)} />}
        {editor && <EditorSheet side={layout === 'desktop' || layout === 'tablet-landscape'} />}
        {shortcuts && layout === 'desktop' && <ShortcutsOverlay />}
      </Suspense>
      <CountInCounter />
      <PedalHud message={hud.message} sequence={hud.sequence} />
    </>
  )
}

// The visual count-in (26 §10): the beat number, not a flash, so it stays under 3 changes a
// second at any tempo that matters and is static text under reduced motion.
function CountInCounter() {
  const { state } = usePractice()
  const beat = usePracticeUi((s) => s.beat)
  if (state !== 'countIn' || !beat) return null
  return (
    <div
      aria-hidden
      data-slot="count-in"
      className="pointer-events-none fixed top-[40%] left-1/2 z-(--z-hud) -translate-x-1/2 -translate-y-1/2 rounded-xl bg-hud-bg px-8 py-4 font-reading text-read-chord-current text-hud-fg tabular-nums"
    >
      {beat.index + 1}
    </div>
  )
}
