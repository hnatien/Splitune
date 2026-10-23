import { InfoIcon, PlayIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { ChordChip } from '@/ui/chord-chip'
import { ConfidenceLegend } from '@/ui/confidence-legend'
import { LoopBadge } from '@/ui/loop-badge'
import { type MixPreset, MixPresetGroup } from '@/ui/mix-preset-group'
import { PassControl } from '@/ui/pass-control'
import { SpeedControl } from '@/ui/speed-control'
import { StemRow } from '@/ui/stem-row'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { TransportButton } from '@/ui/transport-button'

// The Home page's product stills (27 §3.1): real kit components and token-drawn tab and timeline
// with the 8-bar Am–F–C–G example, paused, on paper. Inert: they are pictures of the app, described
// by the text beside them, not controls. Desk reading sizes on every device (a phone's Floor sizes
// overflowed), cropped rather than widening the page at 320 px.

const noop = () => undefined

const CHORDS = [
  { label: 'Am', confidence: 'high', timing: 'past' },
  { label: 'F', confidence: 'high', timing: 'past' },
  { label: 'C', confidence: 'high', timing: 'current' },
  { label: 'G', confidence: 'low', timing: 'upcoming' },
] as const

/** A picture of the app: out of reach of the pointer, keyboard and assistive tech. */
function Still({ className, children }: { className?: string; children: React.ReactNode }) {
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

const STEM_ROWS = [
  { stem: 'guitar', name: () => m['instrument.guitar'](), yourPart: true, muted: false },
  { stem: 'bass', name: () => m['instrument.bass'](), yourPart: false, muted: false },
  { stem: 'drums', name: () => m['instrument.drums'](), yourPart: false, muted: false },
  { stem: 'vocals', name: () => m['instrument.vocals'](), yourPart: false, muted: true },
] as const

function StemRows() {
  return (
    <div className="flex flex-col gap-2">
      {STEM_ROWS.map((row) => (
        <StemRow
          key={row.stem}
          stem={row.stem}
          name={row.name()}
          yourPart={row.yourPart ? m['home.still_your_part']() : undefined}
          muted={row.muted}
          soloed={false}
          gainDb={row.yourPart ? 4 : -6}
          onMutedChange={noop}
          onSoloedChange={noop}
          onGainChange={noop}
          labels={{
            mute: m['home.still_mute'](),
            solo: m['home.still_solo'](),
            volume: m['home.still_volume'](),
            decrease: m['home.still_volume'](),
            increase: m['home.still_volume'](),
          }}
        />
      ))}
    </div>
  )
}

const MIX_OPTIONS: { value: MixPreset; label: () => string; gloss: () => string }[] = [
  {
    value: 'part-loud',
    label: () => m['mixer.preset_part_loud'](),
    gloss: () => m['practice.preset_gloss_part_loud'](),
  },
  {
    value: 'minus-one',
    label: () => m['mixer.preset_minus_one'](),
    gloss: () => m['practice.preset_gloss_minus_one'](),
  },
  {
    value: 'original',
    label: () => m['mixer.preset_original'](),
    gloss: () => m['practice.preset_gloss_original'](),
  },
]

/** The mixer: a preset row over the stems, your part first and turned up. */
export function MixerStill() {
  return (
    <Still className="flex flex-col gap-4">
      <MixPresetGroup
        label={m['practice.mix']()}
        value="part-loud"
        onValueChange={noop}
        options={MIX_OPTIONS.map((o) => ({ value: o.value, label: o.label(), gloss: o.gloss() }))}
      />
      <StemRows />
    </Still>
  )
}

export function LegendStill() {
  return (
    <ConfidenceLegend
      text={m['practice.legend']({ model: '1' })}
      labels={{
        showUncertainty: m['home.still_show_uncertainty'](),
        medium: m['home.still_medium'](),
        low: m['home.still_low'](),
      }}
      showUncertainty
      onShowUncertaintyChange={noop}
    />
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
 * marks. `bars` crops the picture to a range of bars, which shows them larger.
 */
export function TabStill({
  bars,
  className,
}: {
  bars?: { from: number; to: number }
  className?: string
}) {
  const index = (bar: number) => TAB_BARS.findIndex((b) => b.bar === bar)
  const left = bars ? barX(index(bars.from)) - 8 : 0
  const right = bars ? Math.min(TAB.width, barX(index(bars.to) + 1) + 2) : TAB.width
  const loopStart = barX(index(LOOP_BARS.from))
  const loopEnd = barX(index(LOOP_BARS.to) + 1)
  const playhead = noteX(3, 2.5)
  const inLoop = (index: number) => {
    const bar = TAB_BARS[index]?.bar ?? 0
    return bar >= LOOP_BARS.from && bar <= LOOP_BARS.to
  }
  return (
    <div className={cn('overflow-hidden rounded-lg bg-paper text-ink', className)}>
      <svg
        aria-hidden
        viewBox={`${left} 0 ${right - left} ${TAB.height}`}
        className={cn('block w-full font-semibold tabular-nums', !bars && 'min-w-[40rem]')}
      >
        <rect
          x={loopStart}
          y={TAB.top - 22}
          width={loopEnd - loopStart}
          height={TAB.height - TAB.top + 18}
          className="fill-score-loop-fill"
        />
        {[loopStart, loopEnd].map((x) => (
          <g key={x} className="fill-score-loop-edge stroke-score-loop-edge">
            <line x1={x} x2={x} y1={TAB.top - 22} y2={TAB.height - 4} strokeWidth={2} />
            <rect x={x - 5} y={TAB.top - 22} width={10} height={10} rx={2} />
          </g>
        ))}
        <g className="stroke-staff" strokeWidth={1}>
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <line key={s} x1={4} x2={TAB.width - 2} y1={stringY(s)} y2={stringY(s)} />
          ))}
          {TAB_BARS.map((b, i) => (
            <line key={b.bar} x1={barX(i)} x2={barX(i)} y1={TAB.top} y2={STAFF_BOTTOM} />
          ))}
          <line x1={TAB.width - 2} x2={TAB.width - 2} y1={TAB.top} y2={STAFF_BOTTOM} />
        </g>
        <text className="fill-ink text-[13px] font-bold" textAnchor="middle">
          {[...m['home.still_tab_clef']()].map((letter, i) => (
            <tspan key={letter} x={22} y={TAB.top + 14 + i * 20}>
              {letter}
            </tspan>
          ))}
        </text>
        {TAB_BARS.map((b, i) => (
          <g key={b.bar}>
            <text x={barX(i) + 4} y={TAB.top - 8} className="fill-muted-foreground text-[10px]">
              {b.bar}
            </text>
            <text
              x={barX(i) + 18}
              y={TAB.top - 8}
              className={cn('text-[15px] font-bold', INK[b.chordLevel ?? 'high'])}
            >
              {b.chord}
              {b.chordLevel === 'low' && (
                <tspan dy={-6} className="text-[10px]">
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
                      inLoop(i) ? 'fill-score-loop-fill' : 'fill-paper',
                      OUTLINE[level],
                    )}
                  />
                  <text
                    x={x}
                    y={y}
                    dy="0.36em"
                    textAnchor="middle"
                    className={cn('text-[12px]', INK[level])}
                  >
                    {fret}
                  </text>
                  {level === 'low' && (
                    <text x={x + 8} y={y - 6} className="fill-conf-low text-[9px] font-bold">
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
        <line
          x1={playhead}
          x2={playhead}
          y1={TAB.top - 14}
          y2={TAB.height - 4}
          strokeWidth={2}
          className="stroke-score-playhead"
        />
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

/** "Felt clean" / "Not yet" with the best clean tempo so far. */
export function PassStill() {
  return (
    <PassControl
      labels={{
        prompt: m['practice.pass_prompt'](),
        clean: m['practice.felt_clean'](),
        notYet: m['practice.not_yet'](),
      }}
      best={m['practice.best_tempo']({ pct: '65' })}
      onClean={noop}
      onNotYet={noop}
    />
  )
}

/** Other likely chords for the unsure bar, framed as frequency (26 §5). */
export function AlternativesStill() {
  const options = [
    { label: 'G', n: 2 },
    { label: 'Em7', n: 4 },
  ] as const
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3 shadow-1">
      <p className="text-sm font-medium text-muted-foreground">{m['editor.alternatives']()}</p>
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-paper p-2 text-ink">
        {options.map((option) => (
          <span key={option.label} className="flex items-center gap-2">
            <ChordChip label={option.label} confidence="high" />
            <span className="text-sm text-conf-medium">{m['editor.one_in']({ n: option.n })}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The practice screen, as it looks with bars 5–8 looping at 70 %: song bar, chord strip, tab,
 * timeline and transport. `caption` is its text alternative, shown under it.
 */
export function ProductStill({ caption }: { caption: string }) {
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <Still className="rounded-3xl border border-border bg-card shadow-3">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-lg font-semibold">{m['home.still_song']()}</span>
              <span className="text-sm text-muted-foreground">{m['home.still_song_meta']()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="max-sm:hidden">
                <InfoIcon aria-hidden />
                {m['practice.legend_short']({ model: '0.4' })}
              </Badge>
              <ToggleGroup value={['tab']} size="sm">
                <ToggleGroupItem value="tab">{m['practice.notation']()}</ToggleGroupItem>
                <ToggleGroupItem value="chords">{m['practice.chords']()}</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <ChordStill />
          <TabStill />
          <TimelineStill />
          <div className="flex flex-wrap items-center gap-3">
            <TransportButton
              tone="primary"
              className="min-h-16 min-w-16 rounded-full"
              icon={<PlayIcon aria-hidden />}
              label={m['practice.play']()}
              showLabel={false}
            />
            <LoopStill />
            <PassControl
              className="ml-auto max-lg:hidden"
              labels={{
                prompt: m['practice.pass_prompt'](),
                clean: m['practice.felt_clean'](),
                notYet: m['practice.not_yet'](),
              }}
              onClean={noop}
              onNotYet={noop}
            />
          </div>
        </div>
      </Still>
      <figcaption className="text-center text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}
