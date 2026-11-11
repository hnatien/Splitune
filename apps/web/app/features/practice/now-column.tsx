import { ChevronDownIcon } from 'lucide-react'
import { type CSSProperties, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { BeatPulse } from '@/ui/beat-pulse'
import { ChordChip, ChordSymbol } from '@/ui/chord-chip'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { LevelToggle, levelLabel } from './level-toggle'
import { type ChordModel, chordsAround } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

const ChordShape = lazy(() =>
  import('./chord-shape').then((module) => ({ default: module.ChordShape })),
)

// The Now column (27 §3.7.1, 26 §12.2, Main.dc.html; 264 px, padding 20): "Now · bar 26 · beat 3",
// the current chord at --read-chord-current with its shape (84 × 110, mirrored for left-handed
// players), the beat pulse (static until s42), "Next · in 2 beats" with the next chord at
// --read-chord-next and its bar, "Then" with up to five chord chips (unsure ones dashed with "?",
// a tap opens Fix), and at the bottom Level and, for guitar, Capo. Below 1024 px it's the 72 px
// strip above the notation: the current chord, the beats and the next chord. Everything follows the
// audio clock, read once per frame; it re-renders only when the beat or the chord changes. Loads
// with the notation, outside the route's JS budget (12 §10).

const THEN = 5

interface Now {
  bar: number
  /** 1-based. */
  beat: number
  beats: number
  /** The last chord that has started (-1 before the first), and whether it still sounds. */
  index: number
  sounding: boolean
}

function useNow(): Now {
  const { audio, grid, view } = usePractice()
  const chords = view?.chords
  const [now, setNow] = useState<Now>({ bar: 0, beat: 1, beats: 4, index: -1, sounding: false })
  const last = useRef('')
  useEffect(() => {
    if (!grid) return
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const seconds = audio.position()
      const at = grid.positionAt(seconds)
      const around = chordsAround(chords ?? [], seconds)
      const sounding = around.current !== undefined
      const key = `${at.bar}:${at.beat}:${around.index}:${sounding}`
      if (key === last.current) return
      last.current = key
      setNow({
        bar: at.bar,
        beat: at.beat,
        beats: grid.beatsOf(at.bar).length || 4,
        index: around.index,
        sounding,
      })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [audio, grid, chords])
  return now
}

/** Beats from now until a chord starts (whole beats, at least 1). */
function beatsUntil(
  chord: ChordModel | undefined,
  now: Now,
  grid: { beatsOf(bar: number): number[] },
) {
  if (!chord) return undefined
  let count = 0
  for (let bar = now.bar; bar <= chord.bar; bar++) {
    const beats = grid.beatsOf(bar).length || 4
    const from = bar === now.bar ? now.beat : 1
    const to = bar === chord.bar ? chord.beat : beats + 1
    count += Math.max(0, to - from)
  }
  return Math.max(1, count)
}

export function NowColumn({ strip = false }: { strip?: boolean }) {
  const { view, grid, data, options, layers } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const now = useNow()
  if (!grid || !view) return null
  const chords = view.chords
  const current = now.sounding ? chords[now.index] : undefined
  const next = chords[now.index + 1]
  const then = chords.slice(now.index + 2, now.index + 2 + THEN)
  const inBeats = beatsUntil(next, now, grid)
  const beatLabel = m['practice.bar_beat']({ bar: String(now.bar + 1), beat: String(now.beat) })
  const pulse = <BeatPulse beats={now.beats} current={now.beat - 1} label={beatLabel} />
  const name = current ? current.name : m['practice.no_chord_short']()
  const currentChord = (
    <span
      data-slot="now-chord"
      // The fit rule (26 §6.3): a long name ("F♯m7♭5") shrinks to its box, never below the
      // chord sheet's size.
      style={{ '--fit': `calc(100cqi / ${Math.max(2, name.length) * 0.62})` } as CSSProperties}
      className={cn(
        'block font-display text-[length:max(var(--read-chord-sheet),min(var(--read-chord-current),var(--fit)))] leading-[0.85] font-semibold tracking-tight whitespace-nowrap text-ink',
        current && showUncertainty && current.confidence === 'low' && 'text-unsure',
      )}
    >
      {current ? <ChordSymbol name={current.name} /> : name}
    </span>
  )

  if (strip) {
    return (
      <div
        data-slot="now-strip"
        className="flex h-18 shrink-0 items-center gap-6 border-b border-border px-5"
      >
        <span className="flex items-baseline gap-3">
          <span className="text-read-label font-[650] tracking-wider text-faint-foreground uppercase">
            {now.bar < 0
              ? m['practice.now_pickup']()
              : m['practice.now_bar']({ bar: String(now.bar + 1) })}
          </span>
          <span className="font-display text-read-chord font-semibold text-ink">
            {current ? <ChordSymbol name={current.name} /> : name}
          </span>
        </span>
        {pulse}
        {next && (
          <span className="flex items-baseline gap-3">
            <span className="text-read-label font-[650] tracking-wider text-faint-foreground uppercase">
              {m['practice.next_in_beats']({ count: String(inBeats ?? 1) })}
            </span>
            <span className="text-read-chord font-semibold text-ink">
              <ChordSymbol name={next.name} />
            </span>
          </span>
        )}
      </div>
    )
  }

  return (
    <aside
      aria-label={m['practice.glance']()}
      data-slot="now-column"
      className="flex w-66 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border px-5 pt-5 pb-4"
    >
      <p className="text-read-label font-[650] tracking-wider text-faint-foreground uppercase">
        {now.bar < 0
          ? m['practice.now_pickup_beat']({ beat: String(now.beat) })
          : m['practice.now_bar_beat']({ bar: String(now.bar + 1), beat: String(now.beat) })}
      </p>
      <div className="flex items-end justify-between gap-3 @container">
        <div className="min-w-0 flex-1 @container">{currentChord}</div>
        {current && data.instrument === 'guitar' && (
          <Suspense fallback={<span className="h-27.5 w-21 shrink-0" />}>
            <ChordShape
              className="h-27.5 w-21 shrink-0 text-ink"
              label={current.label}
              name={current.name}
              capo={options.capo}
            />
          </Suspense>
        )}
      </div>
      {pulse}
      <hr className="border-border" />
      {next && (
        <div className="flex flex-col gap-1">
          <p className="text-read-label font-[650] tracking-wider text-faint-foreground uppercase">
            {m['practice.next_in_beats']({ count: String(inBeats ?? 1) })}
          </p>
          <p className="flex items-baseline gap-2.5">
            <span className="text-read-chord-next leading-none font-semibold tracking-tight text-ink">
              <ChordSymbol name={next.name} />
            </span>
            <span className="font-mono text-sm text-faint-foreground">
              {m['practice.now_at_bar']({ bar: String(next.bar + 1) })}
            </span>
          </p>
        </div>
      )}
      {then.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-read-label font-[650] tracking-wider text-faint-foreground uppercase">
            {m['practice.then']()}
          </p>
          <ol aria-label={m['practice.chords']()} className="flex flex-wrap gap-x-1.5">
            {then.map((chord) => (
              <li key={chord.id}>
                <ChordChip
                  variant="pill"
                  label={chord.name}
                  confidence={chord.confidence}
                  showUncertainty={showUncertainty}
                  confidenceText={
                    chord.confidence === 'low' ? m['practice.unsure']() : m['practice.probably']()
                  }
                  onClick={() =>
                    usePracticeUi.setState({
                      editor: { kind: 'bar', bar: chord.bar, chordId: chord.id },
                    })
                  }
                />
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="flex-1" />
      {(layers.tab || layers.drums) && <LevelCard capo={data.instrument === 'guitar'} />}
    </aside>
  )
}

// Level and Capo as two rows of a card (27 §3.7.1): each names its value and opens the level and
// capo popover.
function LevelCard({ capo }: { capo: boolean }) {
  const { options } = usePractice()
  const title = capo ? m['practice.level_and_capo']() : m['practice.level']()
  const rows = [
    { label: m['practice.level'](), value: levelLabel(options.level) },
    ...(capo
      ? [
          {
            label: m['practice.capo'](),
            value:
              options.capo > 0
                ? m['practice.capo_fret']({ fret: String(options.capo) })
                : m['practice.capo_none'](),
          },
        ]
      : []),
  ]
  return (
    <div className="flex flex-col rounded-3xl border border-border bg-card p-1">
      {rows.map((row) => (
        <Popover key={row.label}>
          <PopoverTrigger className="flex min-h-target-practice-2 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-muted">
            {capo && <span className="sr-only">{title}: </span>}
            <span className="w-11 shrink-0 text-sm text-faint-foreground">{row.label}</span>{' '}
            <span className="min-w-0 flex-1 py-2 text-md leading-tight font-semibold">
              {row.value}
            </span>
            <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-faint-foreground" />
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="w-auto gap-4">
            <PopoverTitle>{title}</PopoverTitle>
            <LevelToggle capo={capo} />
          </PopoverContent>
        </Popover>
      ))}
    </div>
  )
}
