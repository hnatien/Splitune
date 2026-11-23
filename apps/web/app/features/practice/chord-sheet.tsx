import { chordShapes, transposeChord } from '@splitune/music-core'
import { lazy, Suspense, useEffect, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ChordSymbol } from '@/ui/chord-chip'
import { ChordShape } from './chord-shape'
import type { Paper } from './model/screen'
import { type ChordModel, chordsInBar } from './model/view-model'
import { PianoChart } from './piano-chart'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The falling notes and the staff load on their own, only when shown (12 §10).
const PianoNotes = lazy(() =>
  import('./piano-notes').then((module) => ({ default: module.PianoNotes })),
)
const StaffView = lazy(() =>
  import('./staff-view').then((module) => ({ default: module.StaffView })),
)
const GuitarNotes = lazy(() =>
  import('./guitar-notes').then((module) => ({ default: module.GuitarNotes })),
)
const VocalMelody = lazy(() =>
  import('./vocal-melody').then((module) => ({ default: module.VocalMelody })),
)
const DrumNotes = lazy(() =>
  import('./drum-notes').then((module) => ({ default: module.DrumNotes })),
)

// Chords-only sheet (27 §3.7.3 "+ chords", and the chords_only fallback): bars with their chords,
// the current bar ruled, tap to loop. Piano reads the chord chart instead, or its notes (the
// falling notes, or the staff when chosen); guitar and bass their Notes when chosen; vocals their
// melody; drums their grid (or the drum staff when chosen). They come through this chunk so the route's JS carries one lazy import for all of them
// (12 §10).
export function ChordSheet({
  paper,
  compact = false,
  ...props
}: {
  className?: string | undefined
  onBarActivate: (bar: number) => void
  /** Everything but the tab and the placeholder (model/screen.ts). */
  paper: Exclude<Paper, 'tab' | 'placeholder'>
  /** Phone landscape. */
  compact?: boolean
}) {
  if (paper === 'bar-sheet') return <BarSheet {...props} />
  if (paper === 'piano-chart') return <PianoChart {...props} />
  return (
    <Suspense fallback={<div className={cn('min-h-0 flex-1 bg-paper', props.className)} />}>
      {paper === 'guitar-notes' ? (
        <GuitarNotes {...props} compact={compact} />
      ) : paper === 'piano-notes' ? (
        <PianoNotes {...props} />
      ) : paper === 'piano-staff' ? (
        <StaffView kind="piano" {...props} />
      ) : paper === 'drum-grid' ? (
        <DrumNotes {...props} />
      ) : paper === 'drum-staff' ? (
        <StaffView kind="drums" {...props} />
      ) : (
        <VocalMelody {...props} />
      )}
    </Suspense>
  )
}

function BarSheet({
  className,
  onBarActivate,
}: {
  className?: string | undefined
  onBarActivate: (bar: number) => void
}) {
  const { grid, view, player, audio, data, options } = usePractice()
  const selection = usePracticeUi((s) => s.selection)
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const [current, setCurrent] = useState<number | null>(null)
  useEffect(() => {
    if (!grid) return
    let frame = 0
    let last = Number.NaN
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const bar = grid.positionAt(audio.position()).bar
      if (bar !== last) {
        last = bar
        setCurrent(bar)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [grid, audio])
  if (!grid || !view) return null
  return (
    <section
      aria-label={m['practice.chord_sheet']()}
      data-slot="chord-sheet"
      className={cn(
        '@container min-h-0 flex-1 overflow-y-auto bg-paper px-3 py-4 text-ink sm:px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter',
        className,
      )}
    >
      {data.instrument === 'guitar' && (
        <ul aria-label={m['practice.chord_shapes']()} className="mb-4 flex flex-wrap gap-4">
          {[...new Map(view.chords.map((c) => [c.name, c])).values()].map((chord) =>
            chordShapes(transposeChord(chord.label, -options.capo)).length > 0 ? (
              <li key={chord.name} className="flex flex-col items-center gap-1">
                <ChordShape
                  className="h-20 w-16 text-ink"
                  label={chord.label}
                  name={chord.name}
                  capo={options.capo}
                />
                <span aria-hidden className="font-reading text-read-label">
                  <ChordSymbol name={chord.name} />
                </span>
              </li>
            ) : null,
          )}
        </ul>
      )}
      <ol className="grid grid-cols-2 gap-y-3 border-r border-staff @2xl:grid-cols-4">
        {grid.bars.map((bar) => {
          const chords = chordsInBar(view.chords, grid, bar)
          const loop = player.loop
          const inLoop = loop !== null && bar >= loop.startBar && bar <= loop.endBar
          const armed = selection.kind === 'armed' && selection.bar === bar
          const now = current === bar
          return (
            <li key={bar} className="min-w-0">
              <button
                type="button"
                data-slot="bar-target"
                data-bar={bar}
                aria-pressed={inLoop}
                aria-current={now ? 'true' : undefined}
                onClick={() => onBarActivate(bar)}
                className={cn(
                  'relative flex min-h-24 w-full flex-col items-start gap-2 border-l border-staff bg-transparent px-3 pt-2 pb-3 text-left transition-colors duration-(--duration-fast) hover:bg-hover',
                  // The loop is a band with an ink line along its top and ink at its ends; the
                  // bar playing has the wash with a 2 px ink line under it (26 §4.5).
                  inLoop && 'border-t-2 border-t-score-loop-edge bg-score-loop-fill',
                  loop?.startBar === bar && 'border-l-2 border-l-score-loop-edge',
                  now && 'bg-bar-current',
                  armed && 'outline-2 -outline-offset-2 outline-score-loop-edge outline-dashed',
                )}
              >
                {now && (
                  <span
                    aria-hidden
                    data-slot="bar-now"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-score-playhead"
                  />
                )}
                {loop?.endBar === bar && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 right-0 w-0.5 bg-score-loop-edge"
                  />
                )}
                <span className="flex w-full items-baseline justify-between gap-2 font-reading text-read-bar-number text-muted-foreground tabular-nums">
                  {bar < 0 ? (
                    m['practice.pickup']()
                  ) : (
                    <span>
                      <span className="sr-only">{m['practice.bar_prefix']()} </span>
                      {bar + 1}
                    </span>
                  )}
                  {loop?.startBar === bar && (
                    <span aria-hidden className="text-label-sm text-foreground">
                      {m['practice.loop']()}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-reading text-read-chord-sheet leading-none font-medium">
                  {chords.length === 0
                    ? m['practice.no_chord_short']()
                    : chords.map((chord) => (
                        <SheetChord key={chord.id} chord={chord} marks={showUncertainty} />
                      ))}
                  {chords.length === 0 && (
                    <span className="sr-only">{m['practice.no_chord']()}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// A chord on the sheet (26 §5): always ink and set as charts print it (♭ and ♯, the quality
// raised); "probably" adds a dotted edge, "unsure" a dashed edge and a "?", both named for screen
// readers; with the marks hidden it is plain ink.
function SheetChord({ chord, marks }: { chord: ChordModel; marks: boolean }) {
  const mark = marks && chord.confidence !== 'high'
  return (
    <span
      data-slot="sheet-chord"
      data-confidence={chord.confidence}
      className={cn(
        'inline-flex items-baseline rounded-media border-[1.5px] border-transparent px-1 py-0.5',
        mark && chord.confidence === 'medium' && 'border-dotted border-conf-medium-edge',
        mark && chord.confidence === 'low' && 'border-dashed border-conf-low-edge',
      )}
    >
      <ChordSymbol name={chord.name} />
      {mark && chord.confidence === 'low' && (
        <sup aria-hidden className="ml-0.5 text-[0.45em] text-conf-low-edge">
          ?
        </sup>
      )}
      {mark && (
        <span className="sr-only">
          , {chord.confidence === 'low' ? m['practice.unsure']() : m['practice.probably']()}
        </span>
      )}
    </span>
  )
}
