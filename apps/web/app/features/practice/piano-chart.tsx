import type { ConfidenceLevel } from '@splitune/ui-tokens'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { ChordSymbol, chordText } from '@/ui/chord-chip'
import { type ChartBar, chartLines } from './model/chart'
import { chordsInBar } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The piano chord chart (V13; 27 §3.7.3 "+ chords" for piano): a lead sheet on paper. Four bars
// to a line between barlines, each chord written once where it changes, over its beat, then beat
// slashes. The playhead glides through the bar on the audio clock and the beat's slash darkens
// under it; while playing, the chart keeps the current line second from the top so the next
// line (about a second of look-ahead and more) is always in view. Reduced motion steps the
// playhead by beat and jumps the lines. Bars are buttons: tap A then B loops them.

const ink: Record<ConfidenceLevel, string> = {
  high: 'text-ink',
  medium: 'text-conf-medium',
  low: 'text-conf-low',
}

export function PianoChart({
  className,
  onBarActivate,
}: {
  className?: string | undefined
  onBarActivate: (bar: number) => void
}) {
  const { grid, view, player, audio } = usePractice()
  const selection = usePracticeUi((s) => s.selection)
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const motion = useDisplay((s) => s.motion)
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const reduced = motion === 'reduce' || (motion === 'system' && systemReduce)
  const lines = useMemo(() => (grid && view ? chartLines(grid, view.chords) : []), [grid, view])
  const [at, setAt] = useState({ bar: Number.NaN, beat: 0 })
  const scroller = useRef<HTMLElement>(null)
  const cursor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!grid) return
    let frame = 0
    let last = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const seconds = audio.position()
      const { bar, beat } = grid.positionAt(seconds)
      const key = `${bar}:${beat}`
      if (key !== last) {
        last = key
        setAt({ bar, beat: beat - 1 })
      }
      const el = cursor.current
      if (!el) return
      const start = grid.barStart(bar)
      const length = grid.barEnd(bar) - start
      const beats = grid.beatsOf(bar).length
      const through = length > 0 ? Math.min(1, Math.max(0, (seconds - start) / length)) : 0
      const shown = reduced ? Math.floor(through * beats) / beats : through
      el.style.left = `${(shown * 100).toFixed(2)}%`
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [grid, audio, reduced])

  const lineOf = lines.findIndex((line) => line.bars.some((b) => b.bar === at.bar))
  useEffect(() => {
    const host = scroller.current
    if (!host || lineOf < 0 || !audio.playing()) return
    const target =
      host.querySelector<HTMLElement>(`[data-line="${lineOf - 1}"]`) ??
      host.querySelector<HTMLElement>(`[data-line="${lineOf}"]`)
    if (!target) return
    // Measured against the scroller, not offsetTop: browsers disagree on whether the chart's
    // container query makes it the offset parent, and Safari's answer adds the strip above.
    const gap = Number.parseFloat(getComputedStyle(host).paddingTop) || 0
    const top = target.getBoundingClientRect().top - host.getBoundingClientRect().top
    host.scrollTo({
      top: Math.max(0, host.scrollTop + top - gap),
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [lineOf, audio, reduced])

  if (!grid || !view) return null
  const loop = player.loop
  const bar = (item: ChartBar, first: boolean) => {
    const n = item.bar
    const inLoop = loop !== null && n >= loop.startBar && n <= loop.endBar
    const current = n === at.bar
    const armed = selection.kind === 'armed' && selection.bar === n
    const sounding = chordsInBar(view.chords, grid, n).map((c) => chordText(c.name))
    const number = n < 0 ? m['practice.pickup']() : String(n + 1)
    return (
      <li key={n} className="relative min-w-0">
        <button
          type="button"
          data-slot="bar-target"
          data-bar={n}
          aria-pressed={inLoop}
          aria-current={current ? 'true' : undefined}
          onClick={() => onBarActivate(n)}
          className={cn(
            'relative block h-[calc(var(--read-chord-current)*2.9)] w-full overflow-hidden border-l border-staff bg-transparent text-left transition-colors duration-(--duration-base) ease-standard hover:bg-bar-current',
            inLoop && 'bg-score-loop-fill',
            current && 'bg-bar-current',
            armed && 'outline-2 -outline-offset-2 outline-score-loop-edge outline-dashed',
            loop?.startBar === n && 'border-l-2 border-l-score-loop-edge',
          )}
        >
          {loop?.endBar === n && (
            <span aria-hidden className="absolute inset-y-0 right-0 w-0.5 bg-score-loop-edge" />
          )}
          {inLoop && (
            <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-score-loop-edge" />
          )}
          {/* The name is the bar's own text: "Bar 3, A♭maj7, B♭7, unsure"; a bar that carries a
              chord on names it for screen readers only. */}
          {first || loop?.startBar === n ? (
            <span className="absolute top-1.5 left-2 font-reading text-read-bar-number text-conf-medium tabular-nums">
              <span className="sr-only">{m['practice.bar_prefix']()} </span>
              {number}
            </span>
          ) : (
            <span className="sr-only">{`${m['practice.bar_prefix']()} ${number}`}</span>
          )}
          {item.noChord && (
            <span className="absolute top-[24%] left-3 font-reading text-read-chord-current leading-none font-bold text-conf-medium">
              <span className="sr-only">, {m['practice.no_chord']()}</span>
              <span aria-hidden>{m['practice.no_chord_short']()}</span>
            </span>
          )}
          {item.chords.length === 0 && sounding.length > 0 && (
            <span className="sr-only">, {sounding.join(', ')}</span>
          )}
          {item.chords.map(({ chord, beat }) => {
            const uncertain = showUncertainty && chord.confidence !== 'high'
            // Over its beat; the spacer gives way so a late chord ends at the barline, not past it.
            return (
              <span key={chord.id} className="absolute inset-x-3 top-[24%] flex">
                <span aria-hidden style={{ flexBasis: `${(beat / item.beats) * 100}%` }} />
                <span
                  data-slot="chart-chord"
                  className={cn(
                    'shrink-0 font-reading text-read-chord-current leading-none font-bold',
                    ink[chord.confidence],
                    uncertain && 'border-b-2 border-dashed border-current pb-0.5',
                  )}
                >
                  <span className="sr-only">, </span>
                  <ChordSymbol name={chord.name} />
                  {uncertain && chord.confidence === 'low' && (
                    <sup aria-hidden className="ml-0.5 text-[0.55em]">
                      ?
                    </sup>
                  )}
                  {uncertain && (
                    <span className="sr-only">
                      ,{' '}
                      {chord.confidence === 'low'
                        ? m['practice.unsure']()
                        : m['practice.probably']()}
                    </span>
                  )}
                </span>
              </span>
            )
          })}
          <span aria-hidden className="absolute inset-x-0 bottom-[14%] flex">
            {Array.from({ length: item.beats }, (_, beat) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: beats are positional
                key={beat}
                className={cn(
                  'flex-1 text-center font-reading text-read-chord leading-none font-bold transition-colors duration-(--duration-fast)',
                  current && beat === at.beat ? 'text-ink' : 'text-staff',
                )}
              >
                /
              </span>
            ))}
          </span>
          {current && (
            <span
              ref={cursor}
              aria-hidden
              data-slot="chart-playhead"
              className="absolute inset-y-2 left-0 w-0.5 -translate-x-1/2 rounded-full bg-score-playhead"
            />
          )}
        </button>
      </li>
    )
  }

  return (
    <section
      ref={scroller}
      aria-label={m['practice.chord_chart']()}
      data-slot="piano-chart"
      className={cn(
        '@container min-h-0 flex-1 overflow-y-auto bg-paper px-4 py-4 text-ink motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter md:px-8',
        className,
      )}
    >
      <div className="mx-auto flex max-w-page flex-col gap-2">
        {lines.map((line, index) => (
          <ol
            // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
            key={index}
            data-line={index}
            className="grid grid-cols-2 gap-y-2 border-r border-staff @4xl:grid-cols-4"
          >
            {line.bars.map((item, i) => bar(item, i === 0))}
          </ol>
        ))}
      </div>
    </section>
  )
}
