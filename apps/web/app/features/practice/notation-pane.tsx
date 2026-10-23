import type { AlphaTabViewHandle } from '@splitune/notation'
import { lazy, Suspense, useId, useMemo, useRef, useState } from 'react'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { AnalysisStatus } from './analysis-status'
import { barText } from './bar-text'
import type { PracticeLayout } from './layout'
import { chordsInBar, noteName } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'
import { useScoreTheme } from './score-theme'

// alphaTab loads with the tab layer, outside the route's JS budget (12 §10).
const ChordSheet = lazy(() =>
  import('./chord-sheet').then((module) => ({ default: module.ChordSheet })),
)
const AlphaTabView = lazy(() =>
  import('@splitune/notation/view').then((view) => ({ default: view.AlphaTabView })),
)

// NotationView (12 §2–3, 27 §3.7.3): on paper in every appearance. Before the tab exists it holds
// the analysis status, then a chord-only sheet (for piano, the chord chart), then the tab (for
// piano, the falling notes) — each layer fading in without moving the transport. Bars are buttons:
// tap A then B loops them.

/** summary.recommended_view for the learner's part (05): the global chords-only fallback. */
export function useRecommendedView() {
  const { data } = usePractice()
  const entry = data.summary.data?.per_instrument.find((p) => p.instrument === data.instrument)
  return { reasons: entry?.reasons ?? [], chordsOnly: entry?.recommended_view === 'chords_only' }
}

/**
 * What the paper shows, as the status bar's Tab / Chords switch reads it: chords (the chord sheet,
 * or the glance view on phone portrait, its default) or the tab (piano: the falling notes, its
 * Notes) once one exists and isn't held back by a chords-only recommendation.
 */
export function useShownView(layout: PracticeLayout): 'tab' | 'chords' {
  const { layers } = usePractice()
  const view = usePracticeUi((s) => s.view)
  const forceTab = usePracticeUi((s) => s.forceTab)
  const recommended = useRecommendedView()
  const wanted = view ?? (layout === 'phone-portrait' ? 'chords' : 'tab')
  if (wanted === 'chords' && layers.chords) return 'chords'
  return (layers.tab || layers.roll) && (!recommended.chordsOnly || forceTab) ? 'tab' : 'chords'
}

export function NotationPane({
  interaction = 'bars',
  selectedNoteId = null,
  onNoteActivate,
  onBarActivate,
  className,
}: {
  interaction?: 'bars' | 'notes'
  selectedNoteId?: string | null
  onNoteActivate?: (noteId: string) => void
  /** Instead of the loop's A/B taps (the editor selects bars). */
  onBarActivate?: (bar: number) => void
  className?: string
}) {
  const practice = usePractice()
  const activate = onBarActivate ?? practice.tapBar
  const { layers, data } = practice
  const forceTab = usePracticeUi((s) => s.forceTab)
  const chosen = usePracticeUi((s) => s.view)
  const recommended = useRecommendedView()
  const placeholderId = useId()
  const notation = chosen !== 'chords' && (!recommended.chordsOnly || forceTab)
  if (layers.tab && notation) {
    return (
      <TabView
        interaction={interaction}
        selectedNoteId={selectedNoteId}
        onBarActivate={activate}
        {...(onNoteActivate ? { onNoteActivate } : {})}
        className={className}
      />
    )
  }
  if (layers.chords || layers.roll) {
    return (
      <Suspense fallback={<div className={cn('min-h-0 flex-1 bg-paper', className)} />}>
        <ChordSheet
          className={className}
          onBarActivate={activate}
          notes={layers.roll && (notation || !layers.chords)}
        />
      </Suspense>
    )
  }
  // The placeholder may scroll with nothing focusable in it, so the region itself takes focus
  // (WCAG 2.1.1); practice keys still reach the input mapper from here.
  return (
    <section
      aria-labelledby={placeholderId}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard reachable
      tabIndex={0}
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center gap-6 overflow-y-auto bg-paper px-4 py-6 text-ink',
        className,
      )}
    >
      <p id={placeholderId} className="text-center text-read-label">
        {m['practice.placeholder']()}
      </p>
      <AnalysisStatus data={data} songId={practice.songId} />
    </section>
  )
}

function TabView({
  interaction,
  selectedNoteId,
  onNoteActivate,
  onBarActivate,
  className,
}: {
  interaction: 'bars' | 'notes'
  selectedNoteId: string | null
  onNoteActivate?: (noteId: string) => void
  onBarActivate: (bar: number) => void
  className?: string | undefined
}) {
  const practice = usePractice()
  const { music, grid, view, audio, player, musicState } = practice
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const notationLayout = usePracticeDefaults((s) => s.notationLayout)
  const motion = useDisplay((s) => s.motion)
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const reduced = motion === 'reduce' || (motion === 'system' && systemReduce)
  const selection = usePracticeUi((s) => s.selection)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const theme = useScoreTheme(host)
  const ref = useRef<AlphaTabViewHandle>(null)
  const tab = music?.tab

  const labels = useMemo(() => {
    if (!grid || !view) return new Map<number, string>()
    const notesByBar = new Map<number, string[]>()
    for (const note of view.notes) {
      notesByBar.set(note.bar, [...(notesByBar.get(note.bar) ?? []), noteName(note.pitch)])
    }
    return new Map(
      grid.bars.map((bar) => [
        bar,
        barText(
          bar,
          chordsInBar(view.chords, grid, bar).map((c) => c.name),
          notesByBar.get(bar) ?? [],
        ),
      ]),
    )
  }, [grid, view])

  // Re-render timing after an edit or a capo/level change (12 §10: ≤150 / ≤300 ms).
  const onRendered = (renderMs: number) => {
    const started = musicState.requestedAt
    if (started === undefined) return
    const total = performance.now() - started
    host?.setAttribute('data-render-ms', renderMs.toFixed(0))
    host?.setAttribute('data-update-ms', total.toFixed(0))
  }

  if (!tab || !grid || !view || !theme) {
    return (
      <div ref={setHost} className={cn('min-h-0 flex-1 bg-paper', className)} aria-busy="true" />
    )
  }
  return (
    <div
      ref={setHost}
      data-slot="notation"
      className={cn('flex min-h-0 flex-1 flex-col', className)}
    >
      <Suspense fallback={<div className="min-h-0 flex-1 bg-paper" aria-busy="true" />}>
        <AlphaTabView
          ref={ref}
          className="min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter"
          tex={tab.alphaTex}
          noteMap={tab.noteMap}
          marks={view.marks}
          markers={view.markers}
          times={grid.times}
          theme={theme}
          layout={reduced ? 'page' : notationLayout}
          clock={{ position: () => audio.position(), playing: () => audio.playing() }}
          media={{ duration: () => audio.duration }}
          showUncertainty={showUncertainty}
          loop={player.loop ? { startBar: player.loop.startBar, endBar: player.loop.endBar } : null}
          armedBar={selection.kind === 'armed' ? selection.bar : null}
          interaction={interaction}
          selectedNoteId={selectedNoteId}
          barLabel={(bar) => labels.get(bar) ?? m['practice.bar']({ bar: String(bar + 1) })}
          noteLabel={(id) => {
            const note = view.notes.find((n) => n.id === id)
            return note
              ? m['editor.note_label']({
                  note: noteName(note.pitch),
                  string: String(note.string ?? '–'),
                  fret: String(note.fret ?? '–'),
                })
              : id
          }}
          labels={{
            octaveUp: m['practice.octave_up'](),
            octaveDown: m['practice.octave_down'](),
            region: m['practice.notation'](),
          }}
          onBarActivate={onBarActivate}
          {...(onNoteActivate ? { onNoteActivate } : {})}
          onRendered={onRendered}
          smoothScroll={!reduced}
        />
      </Suspense>
    </div>
  )
}
