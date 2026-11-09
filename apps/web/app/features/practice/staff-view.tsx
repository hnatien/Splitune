import { lazy, Suspense, useMemo, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { chordText } from '@/ui/chord-chip'
import { barText } from './bar-text'
import { barAt } from './model/grid'
import { chordsInBar, staffMarks } from './model/view-model'
import { useLoopLabel, useNotationMotion } from './notation-motion'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'
import { useScoreTheme } from './score-theme'

const AlphaTabView = lazy(() =>
  import('@splitune/notation/view').then((view) => ({ default: view.AlphaTabView })),
)

// The Staff view, drawn by the tab's alphaTab view so the cursor, current bar, loop shading, bar
// taps and confidence marks behave the same. Piano (21 V4, ux/music-display-ui "upgrade path to
// staff notation"): the transcribed notes on a grand staff, right hand on the treble staff and left
// on the bass, in the song's key. Drums (step 25): the hits of the chosen level on a drum staff
// (hands stems up, feet stems down, flams as grace notes). Loads on its own when shown, with
// alphaTab, outside the route's JS budget (12 §10).

export function StaffView({
  kind,
  className,
  onBarActivate,
}: {
  kind: 'piano' | 'drums'
  className?: string | undefined
  onBarActivate: (bar: number) => void
}) {
  const { music, grid, view, audio, player } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const motion = useNotationMotion()
  const loopLabel = useLoopLabel()
  const selection = usePracticeUi((s) => s.selection)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const theme = useScoreTheme(host)
  const piano = kind === 'piano' ? music?.piano : undefined
  const score = kind === 'piano' ? piano : music?.drums

  const marks = useMemo(
    () => staffMarks(piano?.notes ?? music?.drums?.hits ?? []),
    [piano, music?.drums],
  )
  const labels = useMemo(() => {
    if (!grid || !view) return new Map<number, string>()
    // Named in the song's key (E♭4, not D#4), as on the roll's keyboard and the chart. Drum hits
    // have no pitch to name.
    const spelled = (p: number) =>
      `${chordText(music?.noteNames[p % 12] ?? '')}${Math.floor(p / 12) - 1}`
    const notesByBar = new Map<number, string[]>()
    for (const note of piano?.notes ?? []) {
      const bar = barAt(grid, note.t0)
      notesByBar.set(bar, [...(notesByBar.get(bar) ?? []), spelled(note.pitch)])
    }
    return new Map(
      grid.bars.map((bar) => [
        bar,
        barText(
          bar,
          chordsInBar(view.chords, grid, bar).map((c) => chordText(c.name)),
          notesByBar.get(bar) ?? [],
        ),
      ]),
    )
  }, [grid, view, piano, music?.noteNames])

  if (!score || !grid || !theme) {
    return (
      <div ref={setHost} className={cn('min-h-0 flex-1 bg-paper', className)} aria-busy="true" />
    )
  }
  return (
    <div
      ref={setHost}
      data-slot={kind === 'piano' ? 'piano-staff' : 'drum-staff'}
      className={cn('flex min-h-0 flex-1 flex-col', className)}
    >
      <Suspense fallback={<div className="min-h-0 flex-1 bg-paper" aria-busy="true" />}>
        <AlphaTabView
          className="min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter"
          tex={score.staff.alphaTex}
          noteMap={score.staff.noteMap}
          marks={marks}
          times={grid.times}
          theme={theme}
          layout={motion.layout}
          playhead={motion.playhead}
          stepped={motion.stepped}
          loopLabel={loopLabel}
          clock={{ position: () => audio.position(), playing: () => audio.playing() }}
          media={{ duration: () => audio.duration }}
          showUncertainty={showUncertainty}
          loop={player.loop ? { startBar: player.loop.startBar, endBar: player.loop.endBar } : null}
          armedBar={selection.kind === 'armed' ? selection.bar : null}
          interaction="bars"
          barLabel={(bar) => labels.get(bar) ?? m['practice.bar']({ bar: String(bar + 1) })}
          labels={{
            octaveUp: m['practice.octave_up'](),
            octaveDown: m['practice.octave_down'](),
            region: m['practice.view_staff'](),
          }}
          onBarActivate={onBarActivate}
          smoothScroll={motion.smoothScroll}
        />
      </Suspense>
    </div>
  )
}
