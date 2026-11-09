import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { errorCode } from '@/lib/api'
import { m } from '@/lib/i18n'
import { apiErrorMessage } from '@/lib/reasons'
import { PedalHud } from '@/ui/pedal-hud'
import { InlineError } from '@/ui/status-message'
import { toast } from '@/ui/toast'
import { FocusShell } from '../shell/focus-shell'
import { type PaletteAction, parseLoopQuery, usePaletteActions } from '../shell/palette-store'
import { ChordStrip } from './chord-strip'
import { useInputMapper } from './input-mapper'
import { isPhone, type PracticeLayout, useDesktopRegions, usePracticeLayout } from './layout'
import { barRange } from './model/loops'
import { hasNotation, type ViewLabel } from './model/screen'
import { NotationPane, useScreen } from './notation-pane'
import {
  type FetchAudio,
  PracticeProvider,
  type PracticeSearch,
  usePractice,
} from './practice-context'
import { PracticeLoading } from './practice-loading'
import { openTab, usePracticeUi } from './practice-store'
import { PracticeTimeline } from './practice-timeline'
import { PracticeStatus } from './status-bar'
import { TransportBar } from './transport-bar'
import { TransportDock } from './transport-dock'
import { useVideoUrl } from './video-url'

// Overlays and regions that aren't needed at first paint load on demand, outside the route's JS
// budget (12 §10, D6).
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
const PracticeBanners = lazy(() =>
  import('./banners').then((module) => ({ default: module.PracticeBanners })),
)
const ShortcutsOverlay = lazy(() =>
  import('./shortcuts-overlay').then((module) => ({ default: module.ShortcutsOverlay })),
)
const NowColumn = lazy(() =>
  import('./now-column').then((module) => ({ default: module.NowColumn })),
)
const Inspector = lazy(() =>
  import('./inspector').then((module) => ({ default: module.Inspector })),
)
const PassPromptSheet = lazy(() =>
  import('./pass-prompt').then((module) => ({ default: module.PassPromptSheet })),
)

/** True from the first time `open` is true, so an overlay keeps its closing animation. */
function useOpened(open: boolean): boolean {
  const [opened, setOpened] = useState(open)
  if (open && !opened) setOpened(true)
  return opened
}

// PracticeRoute (12 §2, 27 §3.7): the regions per layout around one provider. The page is exactly
// the viewport: the transport sits at the bottom edge and layers fill the flexible middle as
// artefacts land (27 §3.7.3), so nothing arriving ever moves the transport. Desktop has the five
// regions of Main.dc.html — the song map, the Now column, the notation, the inspector and the
// transport dock, with the pass prompt over the notation; tablets and phones keep today's
// arrangement on the Night Rehearsal tokens until s43.

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
  const regions = useDesktopRegions()
  const { song } = practice.data
  const desktop = layout === 'desktop'
  // While the notation is empty the Getting ready cards take the width (Practice-Ready.dc.html):
  // the inspector waits in its drawer, still opened by Tools and the loop and mix pills.
  const empty = useScreen(layout).paper === 'placeholder'
  const docked = regions.docked && !empty
  useInputMapper({ desktop })
  usePracticePalette(layout)
  useArrivals()

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
    <FocusShell
      fill
      exit={practice.guest}
      status={<PracticeStatus layout={layout} tools={desktop && !docked} />}
    >
      {/* Notices sit in one slim stack above the music; it takes no room when there are none. */}
      <div className="flex shrink-0 flex-col gap-2 px-4 py-2 empty:hidden md:px-6 [&>[data-slot=banner]]:py-1.5">
        <Suspense fallback={null}>
          <PracticeBanners />
        </Suspense>
      </div>
      {desktop ? (
        <DesktopRegions docked={docked} nowColumn={regions.nowColumn} roomy={regions.roomyDock} />
      ) : (
        <>
          <CompactRegions layout={layout} />
          <PracticeTimeline compact={layout === 'phone-landscape'} />
          <TransportBar layout={layout} />
        </>
      )}
      <Overlays layout={layout} />
      {children}
    </FocusShell>
  )
}

// Desktop (27 §3.7.1): song map, then the Now column · notation · inspector, then the dock. Below
// 1180 px the inspector is a drawer; below 1024 px the Now column is a strip above the notation.
function DesktopRegions({
  docked,
  nowColumn,
  roomy,
}: {
  docked: boolean
  nowColumn: boolean
  roomy: boolean
}) {
  const { layers, data } = usePractice()
  const screen = useScreen('desktop')
  const editing = usePracticeUi((s) => s.editor)
  // Guitar, bass and other parts read their chords from the Now column over the tab or Notes;
  // piano, drums and vocals keep their strip, and the chord sheet shows its own current chord.
  const now =
    layers.chords &&
    (screen.paper === 'tab' || screen.paper === 'guitar-notes') &&
    data.instrument !== 'piano' &&
    data.instrument !== 'drums' &&
    data.instrument !== 'vocals'
  // A chord, a "?", E or J / K opens the bar in the Fix tab.
  useEffect(() => {
    if (editing) openTab('fix')
  }, [editing])
  return (
    <>
      <PracticeTimeline map />
      <div className="flex min-h-0 flex-1">
        {now && nowColumn && (
          <Suspense fallback={<div className="w-66 shrink-0 border-r border-border" />}>
            <NowColumn />
          </Suspense>
        )}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {now && !nowColumn && (
            <Suspense fallback={<div className="h-18 shrink-0 border-b border-border" />}>
              <NowColumn strip />
            </Suspense>
          )}
          {!now && screen.strip && <ChordStrip />}
          <NotationPane />
          <Floating />
        </div>
        <Suspense
          fallback={
            docked ? <div className="w-95 shrink-0 border-l border-border bg-card" /> : null
          }
        >
          <Inspector docked={docked} />
        </Suspense>
      </div>
      <TransportDock roomy={roomy} />
    </>
  )
}

// Tablets and phones: the chord strip over the tab (or the chord sheet; over vocals' melody, the
// phrase strip), or the glance view on phone portrait. On phone landscape guitar's Notes take the
// strip's room and show its chord themselves.
function CompactRegions({ layout }: { layout: PracticeLayout }) {
  const screen = useScreen(layout)
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {screen.glance ? (
        <Suspense fallback={null}>
          <GlanceView />
        </Suspense>
      ) : (
        <>
          {screen.strip && <ChordStrip compact={isPhone(layout)} />}
          <NotationPane compact={screen.compactNotes} />
        </>
      )}
      <Floating compact />
    </div>
  )
}

// What floats over the notation: the pass prompt (desktop), the HUD at the top right, the
// count-in in the middle and a URL import's video at the bottom right.
function Floating({ compact = false }: { compact?: boolean }) {
  const hud = usePracticeUi((s) => s.hud)
  const videoOpen = usePracticeUi((s) => s.videoOpen)
  const video = useVideoUrl()
  return (
    <>
      {!compact && <PassPrompt />}
      <CountInCounter />
      <PedalHud
        message={hud.message}
        sequence={hud.sequence}
        source={hud.source}
        action={
          hud.setUp
            ? (content, className) => (
                <Link to="/settings/keyboard" tabIndex={-1} className={className}>
                  {content}
                </Link>
              )
            : undefined
        }
      />
      {video.data && videoOpen && (
        <Suspense fallback={null}>
          <VideoPane />
        </Suspense>
      )}
    </>
  )
}

// The pass prompt (27 §3.7.1): after a pass while a loop is active; its code loads then.
function PassPrompt() {
  const practice = usePractice()
  const promptPass = usePracticeUi((s) => s.promptPass)
  if (!practice.player.loop || promptPass === 0) return null
  return (
    <Suspense fallback={null}>
      <PassPromptSheet pass={promptPass} />
    </Suspense>
  )
}

function Overlays({ layout }: { layout: PracticeLayout }) {
  const mixer = useOpened(usePracticeUi((s) => s.mixerOpen))
  const editor = useOpened(usePracticeUi((s) => s.editor !== null))
  const shortcuts = useOpened(usePracticeUi((s) => s.shortcutsOpen))
  const desktop = layout === 'desktop'
  return (
    <Suspense fallback={null}>
      {mixer && !desktop && <MixerDrawer phone={isPhone(layout)} />}
      {editor && !desktop && <EditorSheet side={layout === 'tablet-landscape'} />}
      {shortcuts && desktop && <ShortcutsOverlay />}
    </Suspense>
  )
}

// The visual count-in (27 §3.7.4, 26 §10): the beat number at display size in --primary-ink in the
// middle of the notation with "Count-in · beat 3 of 4" under it — a number, not a flash, so it
// stays under 3 changes a second at any tempo that matters, and static under reduced motion.
function CountInCounter() {
  const { state, grid, audio } = usePractice()
  const beat = usePracticeUi((s) => s.beat)
  if (state !== 'countIn' || !beat) return null
  const beats = grid ? grid.beatsOf(grid.positionAt(audio.position()).bar).length || 4 : 4
  const number = (beat.index % beats) + 1
  return (
    <div
      aria-hidden
      data-slot="count-in"
      className="pointer-events-none absolute top-1/2 left-1/2 z-(--z-hud) flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-4xl border border-border bg-card px-10 py-5 shadow-2"
    >
      <span className="font-display text-read-chord-current leading-none font-semibold text-primary-ink tabular-nums">
        {number}
      </span>
      <span className="text-read-label text-muted-foreground">
        {m['practice.count_in_beat']({ beat: String(number), count: String(beats) })}
      </span>
    </div>
  )
}

// ⌘K (27 §3.12, s34's hook): "Loop bars a–b" from typed text, the saved clips, the view switch's
// views and Display and reading for this screen.
function usePracticePalette(layout: PracticeLayout) {
  const practice = usePractice()
  const screen = useScreen(layout)
  const { grid, clips, setLoop } = practice
  const actions = useMemo<PaletteAction[]>(
    () => [
      {
        id: 'loop-bars',
        label: m['practice.loop'](),
        // Shown only as the row its typed text makes ("loop 17-20").
        run: () => undefined,
        parse: (query) => {
          const bars = parseLoopQuery(query)
          if (!bars || !grid) return undefined
          return {
            label: m['nav.loop_bars']({ start: String(bars.start), end: String(bars.end) }),
            run: () => setLoop(barRange(grid, bars.start - 1, bars.end - 1), 'numeric'),
          }
        },
      },
      ...(screen.viewSwitch?.items ?? []).map((item) => ({
        id: `view-${item.value}`,
        label: m['practice.view_named']({ view: VIEW_NAMES[item.label]() }),
        run: () =>
          usePracticeUi.setState(
            item.value === 'chords'
              ? { view: 'chords', forceTab: false }
              : { view: item.value, forceTab: true },
          ),
      })),
      {
        id: 'display',
        label: m['nav.display_reading'](),
        run: () => usePracticeUi.setState({ displayOpen: true }),
      },
    ],
    [grid, setLoop, screen.viewSwitch],
  )
  usePaletteActions('actions', actions)
  const clipActions = useMemo<PaletteAction[]>(
    () =>
      clips
        .filter((clip) => clip.name !== null)
        .map((clip) => ({
          id: `clip-${clip.id}`,
          label: clip.name ?? '',
          context: m['practice.clip_bars']({ bars: `${clip.start_bar + 1}–${clip.end_bar + 1}` }),
          run: () =>
            setLoop(
              {
                startBar: clip.start_bar,
                endBar: clip.end_bar,
                start: clip.start_s,
                end: clip.end_s,
              },
              'clip',
            ),
        })),
    [clips, setLoop],
  )
  usePaletteActions('clips', clipActions)
}

const VIEW_NAMES: Record<ViewLabel, () => string> = {
  tab: () => m['practice.view_tab'](),
  notes: () => m['practice.view_notes'](),
  staff: () => m['practice.view_staff'](),
  chords: () => m['practice.view_chords'](),
  chart: () => m['practice.view_chart'](),
  grid: () => m['practice.view_grid'](),
  melody: () => m['practice.view_melody'](),
}

// Arrivals (27 §3.7.3): when the notation lands while the learner is playing the chords, it's
// announced once ("Tab is ready" · Show) instead of re-laying out the page under the playhead.
function useArrivals() {
  const { layers, state, data } = usePractice()
  const notation = hasNotation(layers)
  const [had, setHad] = useState(notation)
  useEffect(() => {
    if (notation === had) return
    setHad(notation)
    if (!notation) return
    const busy = state !== 'ready' && state !== 'loading'
    if (!busy) return
    if (layers.chords && usePracticeUi.getState().view === null) {
      usePracticeUi.setState({ view: 'chords' })
    }
    const tab = data.instrument === 'guitar' || data.instrument === 'bass'
    toast.add({
      title: tab ? m['practice.arrived_tab']() : m['practice.arrived_notes'](),
      actionProps: {
        children: m['practice.show'](),
        onClick: () => usePracticeUi.setState({ view: 'tab', forceTab: true }),
      },
    })
  }, [notation, had, state, data.instrument, layers.chords])
}
