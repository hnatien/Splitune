import type { AlphaTabViewHandle, NoteMark } from '@splitune/notation'
import { lazy, Suspense, useId, useMemo, useRef, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { Kbd } from '@/ui/kbd'
import { barText } from './bar-text'
import type { PracticeLayout } from './layout'
import { resolveScreen, type Screen } from './model/screen'
import { chordsInBar, noteName } from './model/view-model'
import { useLoopLabel, useNotationMotion } from './notation-motion'
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
const ScoreTools = lazy(() =>
  import('./score-tools').then((module) => ({ default: module.ScoreTools })),
)
// The progressive state's card loads while the notation is empty (27 §3.7.3).
const GettingReady = lazy(() =>
  import('./getting-ready').then((module) => ({ default: module.GettingReady })),
)

// NotationView (12 §2–3, 27 §3.7.3): on the page in both themes. Before the tab exists it holds
// Getting ready, then a chord-only sheet (for piano, the chord chart), then the tab or, when
// chosen, guitar's Notes (for piano, the falling notes) — each layer fading in without moving the
// transport. Bars are buttons: tap A then B loops them.

/** summary.recommended_view for the learner's part (05): the global chords-only fallback. */
export function useRecommendedView() {
  const { data } = usePractice()
  const entry = data.summary.data?.per_instrument.find((p) => p.instrument === data.instrument)
  return { reasons: entry?.reasons ?? [], chordsOnly: entry?.recommended_view === 'chords_only' }
}

/** What the practice screen shows in this layout (model/screen.ts); the paper is the same in
 * every layout. */
export function useScreen(layout: PracticeLayout): Screen {
  const { layers, data } = usePractice()
  const view = usePracticeUi((s) => s.view)
  const forceTab = usePracticeUi((s) => s.forceTab)
  const { chordsOnly } = useRecommendedView()
  return resolveScreen({ instrument: data.instrument, layers, view, forceTab, chordsOnly, layout })
}

export function NotationPane({
  interaction = 'bars',
  selectedNoteId = null,
  onNoteActivate,
  onBarActivate,
  compact = false,
  className,
}: {
  interaction?: 'bars' | 'notes'
  selectedNoteId?: string | null
  onNoteActivate?: (noteId: string) => void
  /** Instead of the loop's A/B taps (the editor selects bars). */
  onBarActivate?: (bar: number) => void
  /** Phone landscape: guitar's Notes carry the chord the strip would. */
  compact?: boolean
  className?: string
}) {
  const practice = usePractice()
  const activate = onBarActivate ?? practice.tapBar
  const { data } = practice
  const { paper } = useScreen('desktop')
  const placeholderId = useId()
  if (paper === 'tab') {
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
  if (paper !== 'placeholder') {
    return (
      <Suspense fallback={<div className={cn('min-h-0 flex-1 bg-paper', className)} />}>
        <ChordSheet
          className={className}
          onBarActivate={activate}
          paper={paper}
          compact={compact}
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
      data-slot="notation-placeholder"
      className={cn(
        'relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-paper pb-6 text-ink',
        className,
      )}
    >
      <p id={placeholderId} className="sr-only">
        {data.instrument === 'piano'
          ? m['practice.placeholder_piano']()
          : data.instrument === 'vocals'
            ? m['practice.placeholder_vocals']()
            : data.instrument === 'drums'
              ? m['practice.placeholder_drums']()
              : m['practice.placeholder']()}
      </p>
      <Suspense fallback={null}>
        <GettingReady />
      </Suspense>
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
  const { music, grid, view, audio, player, musicState, data } = practice
  const { scoreTools } = useScreen('desktop')
  // Two bars a line where four would run the digits together (27 §3.7.2).
  const narrow = useMediaQuery('(max-width: 640px)', false)
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const motion = useNotationMotion()
  const loopLabel = useLoopLabel()
  const selection = usePracticeUi((s) => s.selection)
  // Fix mode washes the selected bars without the loop's badge, and has its own key line.
  const fixing = usePracticeUi((s) => s.fixing)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const theme = useScoreTheme(host)
  const ref = useRef<AlphaTabViewHandle>(null)
  const tab = music?.tab
  // Notes the learner edited carry the edited mark (26 §5); "Show original" shows none.
  const showOriginal = usePracticeUi((s) => s.showOriginal)
  const noteOps = data.ops.notes.ops
  const marks = useMemo(() => {
    const edited = new Set(
      showOriginal ? [] : noteOps.flatMap((op) => (op.op === 'set_note' ? [op.note_id] : [])),
    )
    if (!view || edited.size === 0) return view?.marks
    return new Map<string, NoteMark>(
      [...view.marks].map(([id, mark]) => [id, edited.has(id) ? { ...mark, edited: true } : mark]),
    )
  }, [view, noteOps, showOriginal])

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

  if (!tab || !grid || !view || !theme || !marks) {
    return (
      <div ref={setHost} className={cn('min-h-0 flex-1 bg-paper', className)} aria-busy="true" />
    )
  }
  return (
    <div
      ref={setHost}
      data-slot="notation"
      className={cn('relative flex min-h-0 flex-1 flex-col', className)}
    >
      <Suspense fallback={<div className="min-h-0 flex-1 bg-paper" aria-busy="true" />}>
        <AlphaTabView
          ref={ref}
          className="min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter"
          tex={tab.alphaTex}
          noteMap={tab.noteMap}
          marks={marks}
          markers={view.markers}
          times={grid.times}
          theme={theme}
          layout={motion.layout}
          barsPerRow={narrow ? 2 : 4}
          playhead={motion.playhead}
          stepped={motion.stepped}
          shakyBars={view.unsureBars}
          loopLabel={fixing ? undefined : loopLabel}
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
          smoothScroll={motion.smoothScroll}
        />
      </Suspense>
      {!fixing && <KeyRow marks={showUncertainty} capo={scoreTools?.capo} />}
    </div>
  )
}

// The key row under the score (27 §3.7.1), in a row of its own so it never hides a note: samples
// of the unsure, probably and sounding marks, how to make a loop with its key, and the level and
// capo at the end. Phones keep the level and capo only, so the notation keeps the height.
function KeyRow({ marks, capo }: { marks: boolean; capo?: boolean | undefined }) {
  const sample =
    'inline-grid min-w-5 place-items-center rounded-media px-0.5 font-reading-mono leading-5 font-medium text-ink'
  return (
    <div
      data-slot="key-row"
      className="flex min-h-9 shrink-0 items-center gap-4 bg-paper px-3 text-caption text-muted-foreground sm:px-4"
    >
      {marks && (
        <div aria-hidden data-slot="marks-key" className="flex items-center gap-4 max-sm:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn(sample, 'border-[1.5px] border-dashed border-conf-low-edge')}>
              3
            </span>
            {m['practice.unsure_key']()}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cn(sample, 'border-[1.5px] border-dotted border-conf-medium-edge')}>
              5
            </span>
            {m['practice.probably_key']()}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={cn(sample, 'bg-primary text-primary-foreground')}>0</span>
            {m['practice.sounding_key']()}
          </span>
        </div>
      )}
      <p className="ml-auto flex items-center gap-1.5 pointer-coarse:hidden max-lg:hidden">
        {m['practice.loop_hint']()}
        <span aria-hidden>·</span>
        <Kbd>4</Kbd>
        {m['practice.loop_hint_key']()}
      </p>
      {capo !== undefined && (
        <Suspense fallback={null}>
          <ScoreTools capo={capo} />
        </Suspense>
      )}
    </div>
  )
}
