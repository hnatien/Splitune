import { chordShapes, transposeChord } from '@splitune/music-core'
import { lazy, Suspense, useEffect, useState } from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ChordShape } from './chord-shape'
import { chordsInBar } from './model/view-model'
import { PianoChart } from './piano-chart'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The falling notes and the staff load on their own, only when shown (12 §10).
const PianoNotes = lazy(() =>
  import('./piano-notes').then((module) => ({ default: module.PianoNotes })),
)
const PianoStaff = lazy(() =>
  import('./piano-staff').then((module) => ({ default: module.PianoStaff })),
)
const GuitarNotes = lazy(() =>
  import('./guitar-notes').then((module) => ({ default: module.GuitarNotes })),
)

// Chords-only sheet (27 §3.7.3 "+ chords", and the chords_only fallback): bars with their chords,
// the current bar ruled, tap to loop. Piano reads the chord chart instead, or its notes (the
// falling notes, or the staff when chosen); guitar and bass their Notes when chosen. They come
// through this chunk so the route's JS carries one lazy import for all of them (12 §10).
export function ChordSheet({
  notes = false,
  compact = false,
  ...props
}: {
  className?: string | undefined
  onBarActivate: (bar: number) => void
  /** The notes instead of the chords: piano's (instead of its chart), guitar's and bass's Notes. */
  notes?: boolean
  /** Phone landscape. */
  compact?: boolean
}) {
  const { data } = usePractice()
  const staff = usePracticeUi((s) => s.view) === 'staff'
  if (data.instrument !== 'piano') {
    return notes ? (
      <Suspense fallback={<div className={cn('min-h-0 flex-1 bg-paper', props.className)} />}>
        <GuitarNotes {...props} compact={compact} />
      </Suspense>
    ) : (
      <BarSheet {...props} />
    )
  }
  if (!notes) return <PianoChart {...props} />
  return (
    <Suspense fallback={<div className={cn('min-h-0 flex-1 bg-paper', props.className)} />}>
      {staff ? <PianoStaff {...props} /> : <PianoNotes {...props} />}
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
        'min-h-0 flex-1 overflow-y-auto bg-paper px-4 py-4 text-ink motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter',
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
                  {chord.name}
                </span>
              </li>
            ) : null,
          )}
        </ul>
      )}
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
        {grid.bars.map((bar) => {
          const chords = chordsInBar(view.chords, grid, bar)
          const inLoop =
            player.loop !== null && bar >= player.loop.startBar && bar <= player.loop.endBar
          const armed = selection.kind === 'armed' && selection.bar === bar
          return (
            <li key={bar}>
              <button
                type="button"
                data-slot="bar-target"
                data-bar={bar}
                aria-pressed={inLoop}
                aria-current={current === bar ? 'true' : undefined}
                onClick={() => onBarActivate(bar)}
                className={cn(
                  'flex min-h-24 w-full flex-col items-start gap-1 rounded-xl border-l-2 bg-transparent px-3 py-2 text-left',
                  inLoop ? 'border-score-loop-edge bg-score-loop-fill' : 'border-staff',
                  armed && 'outline-2 outline-dashed outline-score-loop-edge',
                  current === bar && 'border-b-2 border-b-ink bg-bar-current',
                )}
              >
                <span className="font-reading text-read-bar-number tabular-nums">
                  {bar < 0 ? (
                    m['practice.pickup']()
                  ) : (
                    <>
                      <span className="sr-only">{m['practice.bar_prefix']()} </span>
                      {bar + 1}
                    </>
                  )}
                </span>
                <span className="font-reading text-read-chord">
                  {chords.map((c) => c.name).join('  ') || m['practice.no_chord']()}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
