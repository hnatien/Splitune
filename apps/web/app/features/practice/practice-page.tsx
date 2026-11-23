import type * as React from 'react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { errorCode } from '@/lib/api'
import { m } from '@/lib/i18n'
import { apiErrorMessage } from '@/lib/reasons'

import { toast } from '@/ui/toast'
import { FocusShell } from '../shell/focus-shell'
import { type PaletteAction, parseLoopQuery, usePaletteActions } from '../shell/palette-store'
import { ChordStrip } from './chord-strip'
import { useInputMapper } from './input-mapper'
import { isPhone, type PracticeLayout, usePanelDocked, usePracticeLayout } from './layout'
import { barRange } from './model/loops'
import { hasNotation, type ViewLabel } from './model/screen'
import { NotationPane, useScreen } from './notation-pane'
import {
  type FetchAudio,
  PracticeProvider,
  type PracticeSearch,
  usePractice,
} from './practice-context'
import { PracticeError, PracticeLoading } from './practice-loading'
import { openTab, showHud, usePracticeUi } from './practice-store'
import { PracticeTimeline } from './practice-timeline'
import { PracticeStatus } from './status-bar'
import { Transport } from './transport'
import { useVideoUrl } from './video-url'

// Overlays and regions that aren't needed at first paint load on demand, outside the route's JS
// budget (12 §10, D6).
const HearChords = lazy(() =>
  import('./hear-chords').then((module) => ({ default: module.HearChords })),
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
const Inspector = lazy(() =>
  import('./inspector').then((module) => ({ default: module.Inspector })),
)
// Fix mode (27 §3.7.4): its controller, key line and dock load when Fix is entered.
const FixMode = lazy(() => import('./fix-mode').then((module) => ({ default: module.FixMode })))
const FixKey = lazy(() => import('./fix-mode').then((module) => ({ default: module.FixKey })))
const FixDock = lazy(() => import('./fix-mode').then((module) => ({ default: module.FixDock })))

/** True from the first time `open` is true, so an overlay keeps its closing animation. */
function useOpened(open: boolean): boolean {
  const [opened, setOpened] = useState(open)
  if (open && !opened) setOpened(true)
  return opened
}

// PracticeRoute (12 §2, 27 §3.7): one structure for every layout around one provider. The page
// is exactly the viewport. From the top: the quiet top bar, the song map, the music from edge to
// edge, and the transport at the bottom edge, which nothing arriving ever moves (27 §3.7.3). The
// one panel (Loop · Mix · Progress · Fix) is closed until asked for; it docks beside the music
// from 1180 px and is a sheet above the transport on phones. Nothing floats on the notation
// except the count-in and a URL import's video: the pass prompt lives in the transport.

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
  /** The caller's own line above the song map and its dialogs (onboarding's guide and save
   * sheet). */
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
  const wide = usePanelDocked()
  const { song } = practice.data
  const desktop = layout === 'desktop'
  const screen = useScreen(layout)
  const views = useMemo(
    () => (screen.viewSwitch?.items ?? []).map((item) => item.value),
    [screen.viewSwitch],
  )
  const editing = usePracticeUi((s) => s.editor)
  const fixing = usePracticeUi((s) => s.fixing) && desktop
  useInputMapper({ desktop, views })
  usePracticePalette(layout)
  useArrivals()
  useSheetFix(!desktop)
  const transport = useTransportHeight()

  // The focus sink (12 §8): pedal keys reach the page, never a scroll container's defaults.
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [])

  if (song.isPending || (!song.isError && !practice.settled)) {
    return <PracticeLoading slowText={m['practice.loading']()} />
  }
  if (song.isError) {
    // A song that is gone can't be fetched again; anything else is usually the connection.
    const gone = errorCode(song.error) === 'not_found'
    return (
      <PracticeError
        guest={practice.guest}
        title={gone ? apiErrorMessage('not_found') : m['practice.load_failed']()}
        description={gone ? undefined : m['practice.load_failed_hint']()}
        onRetry={gone ? undefined : () => void song.refetch()}
        retrying={song.isFetching}
        retryLabel={m['common.try_again']()}
        backLabel={practice.guest ? m['nav.exit']() : m['practice.back_to_library']()}
      />
    )
  }
  return (
    <FocusShell fill exit={practice.guest} status={<PracticeStatus layout={layout} />}>
      {/* The caller's own line (onboarding's guide) comes first, in view and in Tab order. */}
      {children}
      {/* Notices sit in one slim stack above the music; it takes no room when there are none. */}
      <div className="flex shrink-0 flex-col gap-2 px-3 py-2 empty:hidden sm:px-4 [&>[data-slot=banner]]:py-1.5">
        <Suspense fallback={null}>
          <PracticeBanners />
        </Suspense>
      </div>
      <PracticeTimeline map compact={isPhone(layout)} />
      <div className="flex min-h-0 flex-1">
        <Stage layout={layout} fixing={fixing} />
        <Suspense fallback={null}>
          <Inspector docked={desktop && wide} layout={layout} />
        </Suspense>
      </div>
      <div ref={transport} className="shrink-0">
        {fixing && editing ? (
          <Suspense fallback={<div className="h-20 border-t border-border" />}>
            <FixDock />
          </Suspense>
        ) : (
          <Transport layout={layout} />
        )}
      </div>
      <Overlays layout={layout} />
    </FocusShell>
  )
}

/** The transport's height as `--transport-height` on the page, for the layers that stop above it
 * (the tools sheet and drawer are portalled out of the practice tree). */
function useTransportHeight() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const root = document.documentElement
    const write = () => root.style.setProperty('--transport-height', `${element.offsetHeight}px`)
    write()
    const observer = new ResizeObserver(write)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--transport-height')
    }
  })
  return ref
}

// The music: a strip where the paper needs one (the lanes' chord, the chord sheet's Now and Next,
// piano's keyboard, the phrases), then the notation from edge to edge; on a phone's Chords view,
// the glance view. In Fix mode a tap selects the bar or the note instead of looping (27 §3.7.4).
function Stage({ layout, fixing }: { layout: PracticeLayout; fixing: boolean }) {
  const { view } = usePractice()
  const screen = useScreen(layout)
  const editing = usePracticeUi((s) => s.editor)
  const desktop = layout === 'desktop'
  // A chord, a "?", E or J / K opens the bar in the Fix tab.
  useEffect(() => {
    if (editing && desktop) openTab('fix')
  }, [editing, desktop])
  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      {screen.glance ? (
        <Suspense fallback={null}>
          <GlanceView />
        </Suspense>
      ) : (
        <>
          {screen.strip && <ChordStrip compact={isPhone(layout)} />}
          {fixing ? (
            <NotationPane
              interaction="notes"
              selectedNoteId={editing?.noteId ?? null}
              onBarActivate={(bar) => usePracticeUi.setState({ editor: { kind: 'bar', bar } })}
              onNoteActivate={(noteId) => {
                const note = view?.notes.find((n) => n.id === noteId)
                if (note) usePracticeUi.setState({ editor: { kind: 'bar', bar: note.bar, noteId } })
              }}
            />
          ) : (
            <NotationPane compact={screen.compactNotes} />
          )}
        </>
      )}
      {fixing && (
        <Suspense fallback={null}>
          <FixKey />
          <FixMode />
        </Suspense>
      )}
      <Floating />
    </div>
  )
}

// What floats over the music: the count-in in the middle and a URL import's video at the bottom
// right. Never a prompt or a tool; the key and pedal line is in the transport.
function Floating() {
  const videoOpen = usePracticeUi((s) => s.videoOpen)
  const video = useVideoUrl()
  return (
    <>
      <CountInCounter />
      {video.data && videoOpen && (
        <Suspense fallback={null}>
          <VideoPane />
        </Suspense>
      )}
    </>
  )
}

function Overlays({ layout }: { layout: PracticeLayout }) {
  const editor = useOpened(usePracticeUi((s) => s.editor !== null))
  const shortcuts = useOpened(usePracticeUi((s) => s.shortcutsOpen))
  const desktop = layout === 'desktop'
  const { layers } = usePractice()
  const hearChords = usePracticeUi((s) => s.hearChords && !s.fixing) && layers.chords
  return (
    <Suspense fallback={null}>
      {hearChords && <HearChords />}
      {editor && !desktop && <EditorSheet side={layout === 'tablet-landscape'} />}
      {shortcuts && <ShortcutsOverlay />}
    </Suspense>
  )
}

// Touch layouts fix a bar in the editor sheet: `?tab=fix` (the desktop editor's way back for a
// touch device, 27 §3.8) opens the first unsure bar there instead of entering Fix mode.
function useSheetFix(compact: boolean) {
  const { view } = usePractice()
  const wanted = usePracticeUi((s) => s.fixing)
  useEffect(() => {
    if (!compact || !wanted || !view) return
    const chord = view.chords.find((c) => c.confidence === 'low')
    const note = view.notes.find((n) => n.confidence === 'low')
    const first =
      chord && (!note || chord.t0 <= note.onset)
        ? { bar: chord.bar, chordId: chord.id }
        : note
          ? { bar: note.bar, noteId: note.id }
          : undefined
    usePracticeUi.setState({ fixing: false, editor: first ? { kind: 'bar', ...first } : null })
    if (!first) showHud(m['practice.hud_no_unsure']())
  }, [compact, wanted, view])
}

// The visual count-in (27 §3.7.4, 26 §10): the beat number at display size in --foreground in the
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
      className="pointer-events-none absolute top-1/2 left-1/2 z-(--z-hud) flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-panel border border-border bg-raised px-10 py-5 shadow-popover"
    >
      <span className="text-read-chord-next leading-none font-medium text-foreground tabular-nums">
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
  const { grid, clips, setLoop, selectClip } = practice
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
          // The clip as it was left: its bars, rest, count-in and speed ladder (12 §5).
          run: () => selectClip(clip, 'clip'),
        })),
    [clips, selectClip],
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
