import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Product stills (27 §3.1–§3.2): the token-drawn tab with fixture data, for Home's practice
// picture and the How it works scenes. Inert: a picture of the app, not a control. Desk reading
// sizes on every device, cropped to fewer bars rather than shrunk below them or widening the page.

/**
 * A picture of the app, out of reach of the pointer and keyboard. With `label` it is one image
 * with that text alternative (what the picture shows); without, it is hidden from assistive tech
 * because the words beside it carry its point.
 */
export function Still({
  label,
  className,
  children,
}: {
  label?: string
  className?: string
  children: React.ReactNode
}) {
  const picture = (
    <div inert data-density="practice" data-distance="desk" className="min-w-0">
      {children}
    </div>
  )
  const frame = cn('min-w-0 overflow-hidden', className)
  return label ? (
    <div role="img" aria-label={label} className={frame}>
      {picture}
    </div>
  ) : (
    <div aria-hidden className={frame}>
      {picture}
    </div>
  )
}

// Tab: bars 4–9 of the example riff, strings 1 (high e, top line) to 6. Each note is
// [eighth 0–7, string, fret, confidence]. Bar 8's chord and two of its notes are the unsure ones.
type Level = 'high' | 'medium' | 'low'
type TabNote = readonly [number, number, number, Level?]
const TAB_BARS: { bar: number; chord: string; chordLevel?: Level; notes: TabNote[] }[] = [
  {
    bar: 4,
    chord: 'G',
    notes: [
      [0, 6, 3],
      [1, 4, 0],
      [2, 3, 0],
      [3, 2, 0],
      [4, 1, 3],
      [5, 2, 0],
      [6, 3, 0],
      [7, 4, 0],
    ],
  },
  {
    bar: 5,
    chord: 'Am',
    notes: [
      [0, 5, 0],
      [1, 3, 2],
      [2, 2, 1],
      [3, 3, 2],
      [4, 4, 2],
      [5, 3, 2],
      [6, 2, 1],
      [7, 1, 0],
    ],
  },
  {
    bar: 6,
    chord: 'F',
    notes: [
      [0, 4, 3],
      [1, 3, 2],
      [2, 2, 1],
      [3, 3, 2],
      [4, 1, 1],
      [5, 3, 2],
      [6, 2, 1],
      [7, 3, 2],
    ],
  },
  {
    bar: 7,
    chord: 'C',
    notes: [
      [0, 5, 3],
      [1, 4, 2],
      [2, 3, 0],
      [3, 2, 1],
      [4, 1, 0],
      [5, 2, 1],
      [6, 3, 0],
      [7, 4, 2],
    ],
  },
  {
    bar: 8,
    chord: 'G',
    chordLevel: 'low',
    notes: [
      [0, 6, 3],
      [1, 5, 2, 'medium'],
      [2, 4, 0],
      [3, 3, 0],
      [4, 1, 3, 'low'],
      [5, 2, 0],
      [6, 3, 0],
      [7, 4, 0],
    ],
  },
  {
    bar: 9,
    chord: 'Am',
    notes: [
      [0, 5, 0],
      [1, 3, 2],
      [2, 2, 1],
      [3, 3, 2],
      [4, 4, 2],
      [5, 3, 2],
      [6, 2, 1],
      [7, 1, 0],
    ],
  },
]

const TAB = { width: 944, height: 144, clef: 44, bar: 150, top: 44, gap: 13, pad: 12 } as const
const LOOP_BARS = { from: 5, to: 8 } as const
const STAFF_BOTTOM = TAB.top + TAB.gap * 5
const barX = (index: number) => TAB.clef + index * TAB.bar
const noteX = (index: number, eighth: number) =>
  barX(index) + TAB.pad + ((TAB.bar - TAB.pad * 1.5) / 8) * (eighth + 0.5)
const stringY = (string: number) => TAB.top + TAB.gap * (string - 1)

const INK: Record<Level, string> = {
  high: 'fill-ink',
  medium: 'fill-conf-medium',
  low: 'fill-conf-low',
}
const OUTLINE: Record<Level, string> = {
  high: '',
  medium: 'stroke-conf-medium',
  low: 'stroke-conf-low',
}

/**
 * Fret numbers on paper with the loop band over bars 5–8, the playhead in bar 7 and the unsure
 * marks. `bars` crops the picture to a range of bars, which shows them larger. How it works draws
 * the same tab before it is looped: `loop` hides the band and `playhead` places the playhead in bars
 * (null hides it).
 */
export function TabStill({
  bars,
  loop = true,
  playhead: playheadBar,
  className,
}: {
  bars?: { from: number; to: number }
  loop?: boolean
  playhead?: number | null | undefined
  className?: string
}) {
  const index = (bar: number) => TAB_BARS.findIndex((b) => b.bar === bar)
  const left = bars ? barX(index(bars.from)) - 8 : 0
  const right = bars ? Math.min(TAB.width, barX(index(bars.to) + 1) + 2) : TAB.width
  const loopStart = barX(index(LOOP_BARS.from))
  const loopEnd = barX(index(LOOP_BARS.to) + 1)
  const playhead =
    playheadBar === undefined
      ? noteX(3, 2.5)
      : playheadBar === null
        ? null
        : barX(index(Math.floor(playheadBar))) + (playheadBar % 1) * TAB.bar
  const inLoop = (x: number) => loop && x >= loopStart && x <= loopEnd
  return (
    <div className={cn('overflow-hidden rounded-field bg-paper text-ink', className)}>
      <svg
        aria-hidden
        viewBox={`${left} 0 ${right - left} ${TAB.height}`}
        className={cn('block w-full font-medium tabular-nums', !bars && 'min-w-[40rem]')}
      >
        {loop && (
          <>
            <rect
              x={loopStart}
              y={TAB.top - 22}
              width={loopEnd - loopStart}
              height={TAB.height - TAB.top + 18}
              className="fill-score-loop-fill"
            />
            {(
              [
                ['start', loopStart],
                ['end', loopEnd],
              ] as const
            ).map(([edge, x]) => (
              <g key={edge} className="fill-score-loop-edge stroke-score-loop-edge">
                <line x1={x} x2={x} y1={TAB.top - 22} y2={TAB.height - 4} strokeWidth={2} />
                <rect x={x - 5} y={TAB.top - 22} width={10} height={10} rx={2} />
              </g>
            ))}
          </>
        )}
        <g className="stroke-staff" strokeWidth={1}>
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <line key={s} x1={4} x2={TAB.width - 2} y1={stringY(s)} y2={stringY(s)} />
          ))}
          {TAB_BARS.map((b, i) => (
            <line key={b.bar} x1={barX(i)} x2={barX(i)} y1={TAB.top} y2={STAFF_BOTTOM} />
          ))}
          <line x1={TAB.width - 2} x2={TAB.width - 2} y1={TAB.top} y2={STAFF_BOTTOM} />
        </g>
        <text className="fill-ink text-body-sm font-medium" textAnchor="middle">
          {[...m['home.still_tab_clef']()].map((letter, i) => (
            <tspan key={letter} x={22} y={TAB.top + 14 + i * 20}>
              {letter}
            </tspan>
          ))}
        </text>
        {TAB_BARS.map((b, i) => (
          <g key={b.bar}>
            <text x={barX(i) + 4} y={TAB.top - 8} className="fill-muted-foreground text-kbd">
              {b.bar}
            </text>
            <text
              x={barX(i) + 18}
              y={TAB.top - 8}
              className={cn('text-body font-medium', INK[b.chordLevel ?? 'high'])}
            >
              {b.chord}
              {b.chordLevel === 'low' && (
                <tspan dy={-6} className="text-kbd">
                  ?
                </tspan>
              )}
            </text>
            {b.notes.map(([eighth, string, fret, level = 'high']) => {
              const x = noteX(i, eighth)
              const y = stringY(string)
              return (
                <g key={`${eighth}-${string}`}>
                  <rect
                    x={x - 6}
                    y={y - 7}
                    width={12}
                    height={14}
                    rx={2}
                    strokeWidth={1.5}
                    strokeDasharray={level === 'high' ? undefined : '2.5 2'}
                    className={cn(
                      inLoop(x) ? 'fill-score-loop-fill' : 'fill-paper',
                      OUTLINE[level],
                    )}
                  />
                  <text
                    x={x}
                    y={y}
                    dy="0.36em"
                    textAnchor="middle"
                    className={cn('text-caption', INK[level])}
                  >
                    {fret}
                  </text>
                  {level === 'low' && (
                    <text x={x + 8} y={y - 6} className="fill-conf-low text-kbd font-medium">
                      ?
                    </text>
                  )}
                </g>
              )
            })}
            <g className="fill-ink stroke-ink">
              {[0, 2, 4, 6].map((pair) => {
                const x1 = noteX(i, pair)
                const x2 = noteX(i, pair + 1)
                const y = STAFF_BOTTOM + 20
                return (
                  <g key={pair}>
                    <line x1={x1} x2={x1} y1={STAFF_BOTTOM + 8} y2={y} strokeWidth={1.25} />
                    <line x1={x2} x2={x2} y1={STAFF_BOTTOM + 8} y2={y} strokeWidth={1.25} />
                    <rect x={x1 - 0.6} y={y - 3} width={x2 - x1 + 1.2} height={3} stroke="none" />
                  </g>
                )
              })}
            </g>
          </g>
        ))}
        {playhead !== null && (
          <line
            x1={playhead}
            x2={playhead}
            y1={TAB.top - 14}
            y2={TAB.height - 4}
            strokeWidth={2}
            className="stroke-score-playhead"
          />
        )}
      </svg>
    </div>
  )
}
