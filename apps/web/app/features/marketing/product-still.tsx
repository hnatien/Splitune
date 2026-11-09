import { PauseIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { ChordChip } from '@/ui/chord-chip'
import { LoopBadge } from '@/ui/loop-badge'
import { SpeedControl } from '@/ui/speed-control'

// Product stills (27 §3.1, §3.2, §3.4): real kit components and token-drawn tab and timeline with
// fixture data. Inert: they are pictures of the app, described by the text beside them (or by their
// own `role="img"` label), not controls. Desk reading sizes on every device (a phone's Floor sizes
// overflowed), cropped rather than widening the page at 320 px. Home's pictures show only what is
// built (27 §3.1 honesty gates): your part and the band in the mixer until every stem has a fader
// (s40b), the loop and speed until the speed ladder ships (s37).

const noop = () => undefined

const CHORDS = [
  { label: 'Am', confidence: 'high', timing: 'past' },
  { label: 'F', confidence: 'high', timing: 'past' },
  { label: 'C', confidence: 'high', timing: 'current' },
  { label: 'G', confidence: 'low', timing: 'upcoming' },
] as const

/** A picture of the app: out of reach of the pointer, keyboard and assistive tech. */
export function Still({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      inert
      aria-hidden
      data-density="practice"
      data-distance="desk"
      className={cn('min-w-0 overflow-hidden', className)}
    >
      {children}
    </div>
  )
}

/** The chord strip sits on paper, like the score (26 §2); the controls around it are chrome. */
export function ChordStill() {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-paper p-3 text-ink">
      {CHORDS.map((chord) => (
        <ChordChip
          key={chord.label}
          label={chord.label}
          confidence={chord.confidence}
          timing={chord.timing}
          showUncertainty
        />
      ))}
    </div>
  )
}

export function LoopStill() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <LoopBadge state="active">{m['home.still_loop']()}</LoopBadge>
      <SpeedControl
        value={70}
        bpm={100}
        onValueChange={noop}
        labels={{
          speed: m['home.still_speed'](),
          decrease: m['home.still_speed'](),
          increase: m['home.still_speed'](),
          presets: m['home.still_speed'](),
        }}
      />
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
  playhead?: number | null
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
    <div className={cn('overflow-hidden rounded-lg bg-paper text-ink', className)}>
      <svg
        aria-hidden
        viewBox={`${left} 0 ${right - left} ${TAB.height}`}
        className={cn('block w-full font-semibold tabular-nums', !bars && 'min-w-[40rem]')}
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
        <text className="fill-ink text-sm font-bold" textAnchor="middle">
          {[...m['home.still_tab_clef']()].map((letter, i) => (
            <tspan key={letter} x={22} y={TAB.top + 14 + i * 20}>
              {letter}
            </tspan>
          ))}
        </text>
        {TAB_BARS.map((b, i) => (
          <g key={b.bar}>
            <text x={barX(i) + 4} y={TAB.top - 8} className="fill-muted-foreground text-2xs">
              {b.bar}
            </text>
            <text
              x={barX(i) + 18}
              y={TAB.top - 8}
              className={cn('text-base font-bold', INK[b.chordLevel ?? 'high'])}
            >
              {b.chord}
              {b.chordLevel === 'low' && (
                <tspan dy={-6} className="text-2xs">
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
                    className={cn('text-xs', INK[level])}
                  >
                    {fret}
                  </text>
                  {level === 'low' && (
                    <text x={x + 8} y={y - 6} className="fill-conf-low text-2xs font-bold">
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

// The whole song's waveform, 32 bars, with the loop on bars 5–8 and the playhead in bar 7.
const SONG_BARS = 32
const WAVE = { width: 944, height: 56, bins: 236 } as const
const PEAKS = Array.from({ length: WAVE.bins }, (_, i) => {
  const swell = Math.abs(Math.sin(i * 0.21) * Math.cos(i * 0.047))
  const grain = ((i * 37) % 11) / 11
  const section = i > 60 && i < 150 ? 0.12 : 0
  return Math.min(1, 0.22 + 0.5 * swell + 0.16 * grain + section)
})

export function TimelineStill({ className }: { className?: string }) {
  const atBar = (bar: number) => ((bar - 1) / SONG_BARS) * WAVE.width
  const loopStart = atBar(LOOP_BARS.from)
  const loopEnd = atBar(LOOP_BARS.to + 1)
  const playhead = atBar(7.3)
  const step = WAVE.width / WAVE.bins
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      <svg
        aria-hidden
        viewBox={`0 0 ${WAVE.width} ${WAVE.height}`}
        className="block h-14 w-full"
        preserveAspectRatio="none"
      >
        <rect
          x={loopStart}
          y={0}
          width={loopEnd - loopStart}
          height={WAVE.height}
          className="fill-loop-fill"
        />
        {PEAKS.map((peak, i) => {
          const x = i * step
          const h = Math.max(2, peak * (WAVE.height - 12))
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: bins are positional and never reorder
              key={i}
              x={x + step * 0.2}
              y={(WAVE.height - h) / 2}
              width={step * 0.6}
              height={h}
              className={x < playhead ? 'fill-waveform-played' : 'fill-waveform-peak'}
            />
          )
        })}
        {[loopStart, loopEnd].map((x) => (
          <line
            key={x}
            x1={x}
            x2={x}
            y1={0}
            y2={WAVE.height}
            strokeWidth={3}
            className="stroke-loop-edge"
          />
        ))}
        <line
          x1={playhead}
          x2={playhead}
          y1={0}
          y2={WAVE.height}
          strokeWidth={2}
          className="stroke-playhead"
        />
      </svg>
    </div>
  )
}

// Home's hero: two bars of tab, F then C, with the sounding digit, one unsure digit and the
// playhead in the current bar. Strings are 1 (high e, top line) to 6; each note is [x in the bar
// (0–1), string, fret, state].
type HeroNote = readonly [number, number, number, 'past' | 'now' | 'unsure' | 'next']
const HERO_BARS: { chord: string; current: boolean; notes: HeroNote[] }[] = [
  {
    chord: 'F',
    current: false,
    notes: [
      [0.1, 4, 3, 'past'],
      [0.3, 3, 2, 'past'],
      [0.5, 2, 1, 'past'],
      [0.7, 1, 1, 'past'],
      [0.9, 2, 1, 'past'],
    ],
  },
  {
    chord: 'C',
    current: true,
    notes: [
      [0.1, 5, 3, 'past'],
      [0.3, 4, 2, 'past'],
      [0.5, 3, 0, 'now'],
      [0.7, 2, 1, 'unsure'],
      [0.9, 1, 0, 'next'],
    ],
  },
]
const HERO_TAB = { bar: 200, top: 36, gap: 20 } as const
const HERO_NOTE_INK = {
  past: 'fill-faint-foreground',
  now: 'fill-primary-foreground',
  unsure: 'fill-unsure',
  next: 'fill-foreground',
} as const

function HeroTab() {
  const stringY = (string: number) => HERO_TAB.top + HERO_TAB.gap * (string - 1)
  const bottom = stringY(6)
  const playhead = 1 + 1.55 * HERO_TAB.bar
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${HERO_TAB.bar * 2 + 2} ${bottom + 12}`}
      className="block w-full font-mono font-semibold tabular-nums"
    >
      {HERO_BARS.map((bar, i) => {
        const x0 = 1 + i * HERO_TAB.bar
        return (
          <g key={bar.chord}>
            <rect
              x={x0}
              y={HERO_TAB.top - 6}
              width={HERO_TAB.bar}
              height={bottom - HERO_TAB.top + 12}
              className={bar.current ? 'fill-bar-current' : 'fill-score-loop-fill'}
            />
            <text x={x0 + 8} y={HERO_TAB.top - 16} className="fill-foreground font-sans text-lg">
              {bar.chord}
            </text>
          </g>
        )
      })}
      <g className="stroke-staff" strokeWidth={1}>
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <line key={s} x1={1} x2={HERO_TAB.bar * 2 + 1} y1={stringY(s)} y2={stringY(s)} />
        ))}
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={1 + i * HERO_TAB.bar}
            x2={1 + i * HERO_TAB.bar}
            y1={HERO_TAB.top}
            y2={bottom}
          />
        ))}
      </g>
      {HERO_BARS.map((bar, i) =>
        bar.notes.map(([at, string, fret, state]) => {
          const x = 1 + (i + at) * HERO_TAB.bar
          const y = stringY(string)
          return (
            <g key={`${bar.chord}-${string}-${at}`}>
              <rect
                x={x - 9}
                y={y - 9}
                width={18}
                height={18}
                rx={4}
                strokeWidth={1.5}
                strokeDasharray={state === 'unsure' ? '3 2' : undefined}
                className={cn(
                  state === 'now' ? 'fill-primary' : bar.current ? 'fill-bar-current' : 'fill-card',
                  state === 'unsure' && 'stroke-unsure',
                )}
              />
              <text
                x={x}
                y={y}
                dy="0.36em"
                textAnchor="middle"
                className={cn('text-base', HERO_NOTE_INK[state])}
              >
                {fret}
              </text>
              {state === 'unsure' && (
                <text x={x + 10} y={y - 9} className="fill-unsure font-sans text-2xs font-bold">
                  ?
                </text>
              )}
            </g>
          )
        }),
      )}
      <line
        x1={playhead}
        x2={playhead}
        y1={HERO_TAB.top - 14}
        y2={bottom + 10}
        strokeWidth={2}
        className="stroke-playhead"
      />
    </svg>
  )
}

const BEATS = ['done', 'done', 'now', 'slot'] as const

/**
 * Home's hero (27 §3.1): the practice screen looping bars 25–28 at 75 %, with the Now column (C,
 * the beat, next G), two bars of tab and the pass prompt. `label` is its text alternative.
 */
export function HeroStill({ label }: { label: string }) {
  return (
    <div role="img" aria-label={label} className="min-w-0">
      <Still className="flex flex-col gap-3.5 rounded-4xl border border-border bg-card p-4.5 shadow-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-semibold">{m['home.still_hero_song']()}</span>
          <span className="text-sm text-faint-foreground">{m['instrument.guitar']()}</span>
          <Badge variant="primary" className="ml-auto">
            {m['home.still_hero_loop']()}
          </Badge>
        </div>
        <div className="flex items-stretch gap-4.5">
          <div className="flex w-24 flex-none flex-col gap-2.5 border-r border-border pr-4 sm:w-32.5">
            <span className="text-xs text-faint-foreground uppercase">{m['home.still_now']()}</span>
            <span className="font-display text-display leading-none">C</span>
            <span className="flex items-center gap-2.5">
              {BEATS.map((beat, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: beats are positional and never reorder
                  key={i}
                  className={cn(
                    'size-3.5 border-2',
                    i === 0 ? 'rounded-xs' : 'rounded-full',
                    beat === 'done' && 'border-beat-done bg-beat-done',
                    beat === 'now' && 'border-beat-now bg-beat-now shadow-glow',
                    beat === 'slot' && 'border-beat-slot',
                  )}
                />
              ))}
            </span>
            <span className="mt-1.5 text-xs text-faint-foreground uppercase">
              {m['home.still_next']()}
            </span>
            <span className="text-read-chord-sheet leading-none font-semibold">G</span>
          </div>
          <div className="min-w-0 flex-1 pt-2">
            <HeroTab />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-play">
            <PauseIcon aria-hidden className="size-5 fill-current" />
          </span>
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            {m['home.still_hero_pass']()}
          </span>
          <Button variant="primary" size="sm">
            {m['practice.felt_clean']()}
          </Button>
          <Button size="sm">{m['practice.not_yet']()}</Button>
        </div>
      </Still>
    </div>
  )
}

const LEVELS = [
  { id: 'part', name: () => m['instrument.guitar'](), level: 'w-[86%]', colour: 'bg-stem-guitar' },
  { id: 'band', name: () => m['home.still_band'](), level: 'w-[48%]', colour: 'bg-stem-mix' },
] as const

/** "Hear your part on its own": your part turned up over the band. */
export function StemLevelsStill() {
  return (
    <Still className="flex flex-col gap-2.5 rounded-3xl border border-border bg-background p-3.5">
      {LEVELS.map((row) => (
        <div key={row.id} className="flex items-center gap-2.5">
          <span className={cn('h-5.5 w-1.25 rounded-xs', row.colour)} />
          <span className="w-16 text-sm font-semibold">{row.name()}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent">
            <span className={cn('block h-full rounded-full', row.level, row.colour)} />
          </span>
        </div>
      ))}
    </Still>
  )
}

/** "Tab that admits when it's unsure": a sure and an unsure digit, and the likely alternatives. */
export function UnsureStill() {
  const options = [
    { label: 'Am7', n: 3 },
    { label: 'C/A', n: 5 },
  ] as const
  return (
    <Still className="flex flex-wrap items-center justify-around gap-4 rounded-3xl border border-border bg-background px-3.5 py-5.5">
      <span className="font-mono text-read-tab font-semibold tabular-nums">5</span>
      <span className="relative rounded-sm px-1 font-mono text-read-tab font-semibold text-unsure tabular-nums outline-[1.5px] outline-offset-1 outline-unsure outline-dashed">
        7<span className="absolute -top-3 -right-3 font-sans text-2xs">?</span>
      </span>
      <span className="flex flex-col gap-1.5">
        {options.map((option) => (
          <span
            key={option.label}
            className="inline-flex h-7.5 items-center rounded-full border border-border px-3 text-sm font-medium text-muted-foreground"
          >
            {m['home.still_alternative']({ chord: option.label, n: String(option.n) })}
          </span>
        ))}
      </span>
    </Still>
  )
}
