import type { NoteMark } from '@splitune/notation'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { chordText } from '@/ui/chord-chip'
import { barText } from './bar-text'
import { chordsInBar } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'
import { useScoreTheme } from './score-theme'

const AlphaTabView = lazy(() =>
  import('@splitune/notation/view').then((view) => ({ default: view.AlphaTabView })),
)

// Drums' Staff view (step 25): the hits of the chosen level on a drum staff (hands stems up, feet
// stems down, flams as grace notes), drawn by the tab's alphaTab view so the cursor, current bar,
// loop shading, bar taps and confidence marks behave the same. A kit-piece guess is marked like a
// medium-confidence note. Loads on its own when shown, with alphaTab, outside the route's JS
// budget (12 §10).

export function DrumStaff({
  className,
  onBarActivate,
}: {
  className?: string | undefined
  onBarActivate: (bar: number) => void
}) {
  const { music, grid, view, audio, player } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const notationLayout = usePracticeDefaults((s) => s.notationLayout)
  const motion = useDisplay((s) => s.motion)
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const reduced = motion === 'reduce' || (motion === 'system' && systemReduce)
  const selection = usePracticeUi((s) => s.selection)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const theme = useScoreTheme(host)
  const drums = music?.drums

  const marks = useMemo(
    () =>
      new Map<string, NoteMark>(
        (drums?.hits ?? []).map((h) => {
          const level = h.approximate && h.band === 'high' ? 'medium' : h.band
          return [h.id, h.residualFlagged ? { level, timingFlagged: true } : { level }]
        }),
      ),
    [drums],
  )
  const labels = useMemo(() => {
    if (!grid || !view) return new Map<number, string>()
    return new Map(
      grid.bars.map((bar) => [
        bar,
        barText(
          bar,
          chordsInBar(view.chords, grid, bar).map((c) => chordText(c.name)),
          [],
        ),
      ]),
    )
  }, [grid, view])

  if (!drums || !grid || !theme) {
    return (
      <div ref={setHost} className={cn('min-h-0 flex-1 bg-paper', className)} aria-busy="true" />
    )
  }
  return (
    <div
      ref={setHost}
      data-slot="drum-staff"
      className={cn('flex min-h-0 flex-1 flex-col', className)}
    >
      <Suspense fallback={<div className="min-h-0 flex-1 bg-paper" aria-busy="true" />}>
        <AlphaTabView
          className="min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter"
          tex={drums.staff.alphaTex}
          noteMap={drums.staff.noteMap}
          marks={marks}
          times={grid.times}
          theme={theme}
          layout={reduced ? 'page' : notationLayout}
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
          smoothScroll={!reduced}
        />
      </Suspense>
    </div>
  )
}
