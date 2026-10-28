import {
  DRUM_LANES,
  DrumGrid,
  type DrumGridTheme,
  type DrumLane,
  type GridHit,
} from '@splitune/notation'
import { readColor, type TokenName } from '@splitune/ui-tokens'
import { useMemo, useState } from 'react'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { barAt } from './model/grid'
import { usePractice } from './practice-context'
import { useTokens } from './score-theme'

// Drums' Grid view (step 25, 21 V5): the hits of the chosen level in lanes on the beat grid, named
// down the left as on a drum staff (cymbals and hi-hat at the top, kick at the bottom), scrolling
// past a fixed playhead on the transport clock. Two bars are in view; with reduced motion the grid
// turns two bars at a time and only the playhead moves. Kit-piece guesses and medium or low hits
// are hollow and dashed, low ones also carry "?" (26 §5). A click on the grid loops bars like a tap
// on the chart (A then B); the loop panel and the practice keys do the same from the keyboard.
// Loads on its own when shown, outside the route's JS budget (12 §10).

const BARS_IN_VIEW = 2

const LANE_LABEL: Record<DrumLane, () => string> = {
  cymbals: () => m['practice.drum_cymbals'](),
  hihat: () => m['practice.drum_hihat'](),
  toms: () => m['practice.drum_toms'](),
  snare: () => m['practice.drum_snare'](),
  kick: () => m['practice.drum_kick'](),
}

function readGridTheme(element: HTMLElement): DrumGridTheme {
  const token = (name: TokenName) => readColor(name, element)
  const style = getComputedStyle(element)
  return {
    family: style.fontFamily,
    barNumberPx: Number.parseFloat(style.fontSize) || 14,
    ink: token('--ink'),
    paper: token('--paper'),
    staff: token('--staff'),
    playhead: token('--score-playhead'),
    loopFill: token('--score-loop-fill'),
    loopEdge: token('--score-loop-edge'),
    barLabel: token('--conf-medium'),
    medium: token('--conf-medium'),
    low: token('--conf-low'),
  }
}

export function DrumNotes({
  className,
  onBarActivate,
}: {
  className?: string | undefined
  onBarActivate: (bar: number) => void
}) {
  const { music, grid, audio, player } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const motion = useDisplay((s) => s.motion)
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const reduced = motion === 'reduce' || (motion === 'system' && systemReduce)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const theme = useTokens(host, readGridTheme)
  const drums = music?.drums
  const hits = useMemo<GridHit[]>(
    () =>
      (drums?.hits ?? []).map((h) => ({
        id: h.id,
        lane: h.class5,
        gmNote: h.gmNote,
        t0: h.t0,
        band: h.band,
        approximate: h.approximate,
        flam: h.flam,
      })),
    [drums],
  )
  const timing = useMemo(() => {
    if (!grid) return undefined
    const lengths = grid.bars
      .map((bar) => grid.barEnd(bar) - grid.barStart(bar))
      .sort((a, b) => a - b)
    return {
      bars: grid.bars.map((bar) => ({
        t: grid.barStart(bar),
        label: bar < 0 ? m['practice.pickup']() : String(bar + 1),
      })),
      beats: grid.bars.flatMap((bar) => grid.beatsOf(bar).slice(1)),
      // The median bar, so the grid's speed doesn't jump with small tempo changes.
      span: BARS_IN_VIEW * (lengths[lengths.length >> 1] ?? 2),
    }
  }, [grid])

  if (!grid || !timing) return null
  const loop = player.loop
  // Pages of two bars from the bar that holds a time (reduced motion).
  const page = (t: number) => {
    const bar = barAt(grid, t)
    const first = grid.bars[0] ?? 0
    return grid.barStart(bar - ((bar - first) % BARS_IN_VIEW))
  }
  return (
    <section
      ref={setHost}
      aria-label={m['practice.view_grid']()}
      data-slot="drum-notes"
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-paper px-4 pt-2 pb-3 font-reading text-read-bar-number text-ink motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter md:px-8',
        className,
      )}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-page flex-1 gap-3">
        <ul
          aria-label={m['practice.drum_lanes']()}
          className="flex shrink-0 flex-col text-read-label"
          style={{ paddingTop: (theme?.barNumberPx ?? 14) + 6 }}
        >
          {DRUM_LANES.map((lane) => (
            <li key={lane} className="flex flex-1 items-center justify-end">
              {LANE_LABEL[lane]()}
            </li>
          ))}
        </ul>
        {theme && (
          <DrumGrid
            className="min-h-0 min-w-0 flex-1 cursor-pointer"
            hits={hits}
            clock={() => audio.position()}
            span={timing.span}
            bars={timing.bars}
            beats={timing.beats}
            loop={loop ? { t0: grid.barStart(loop.startBar), t1: grid.barEnd(loop.endBar) } : null}
            page={reduced ? page : undefined}
            showUncertainty={showUncertainty}
            theme={theme}
            label={m['practice.drum_grid']()}
            onTimeActivate={(t) => onBarActivate(barAt(grid, t))}
          />
        )}
      </div>
      <p className="mx-auto w-full max-w-page pt-2 text-read-label">{m['practice.drum_key']()}</p>
    </section>
  )
}
