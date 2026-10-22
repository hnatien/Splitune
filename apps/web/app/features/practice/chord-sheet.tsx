import { chordShapes, transposeChord } from '@splitune/music-core'
import { ChordDiagram } from '@splitune/notation'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { m } from '@/lib/i18n'
import { meQuery } from '@/lib/session'
import { cn } from '@/lib/utils'
import { chordsInBar } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// Chords-only sheet (27 §3.7.3 "+ chords", and the chords_only fallback): bars with their chords,
// the current bar ruled, tap to loop.
export function ChordSheet({
  className,
  onBarActivate,
}: {
  className?: string | undefined
  onBarActivate: (bar: number) => void
}) {
  const { grid, view, player, audio, data, options } = usePractice()
  const me = useQuery(meQuery)
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
          {[...new Map(view.chords.map((c) => [c.name, c])).values()].map((chord) => {
            const shape = chordShapes(transposeChord(chord.label, -options.capo))[0]
            return shape ? (
              <li key={chord.name} className="flex flex-col items-center gap-1">
                <ChordDiagram
                  className="h-20 w-16 text-ink"
                  frets={shape.frets}
                  mirrored={me.data?.handedness === 'left'}
                  label={m['editor.diagram']({ chord: chord.name })}
                />
                <span aria-hidden className="font-reading text-read-label">
                  {chord.name}
                </span>
              </li>
            ) : null
          })}
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
                  'flex min-h-24 w-full flex-col items-start gap-1 rounded-lg border-l-2 bg-transparent px-3 py-2 text-left',
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
