import { KeyboardDiagram } from '@splitune/notation'
import { ArrowRightIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useState } from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ChordTiming } from '@/ui/chord-chip'
import { ChordSymbol } from '@/ui/chord-chip'
import { type ChordModel, chordsAround, noteName } from './model/view-model'
import { PianoOptions } from './piano-options'
import { usePianoVoicings } from './piano-voicing'
import { usePractice } from './practice-context'

// The chord strip for piano (V13): "now → next" with the hands on a keyboard. The current chord
// with its bar and the bar's beats, its voicing (left hand bass, right hand chord, L and R on the
// keys and below them); then the next chord with how many beats away it is and a small keyboard,
// so the change is seen coming (sight-readers look about a second ahead); then the two after it.
// Narrow strips drop the extras from the end. Loads with the strip, outside the route budget.

const EPS = 1e-3
// Beyond this many beats the next change is named by its bar.
const COUNT_BEATS = 8
const THEN = 2

interface Now {
  index: number
  next: number
  /** Beats until the next chord starts. */
  beats: number
  bar: number
  /** 0-based beat of the bar, and the bar's beat count. */
  beat: number
  beatsInBar: number
  /** 0-based beat of this bar where the next chord starts, or -1. */
  changeBeat: number
}

const START: Now = { index: -1, next: -1, beats: 0, bar: 0, beat: 0, beatsInBar: 4, changeBeat: -1 }

// Beat times in (from, to]: binary search over the grid's increasing times.
function beatsBetween(times: readonly number[], from: number, to: number) {
  const after = (t: number) => {
    let lo = 0
    let hi = times.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((times[mid] as number) <= t) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  return Math.max(0, after(to + EPS) - after(from))
}

const label = 'text-xs font-semibold tracking-wide text-conf-medium uppercase'

export function PianoStrip({
  chip,
}: {
  chip: (chord: ChordModel, timing: ChordTiming) => React.ReactNode
}) {
  const { view, audio, grid } = usePractice()
  const voicings = usePianoVoicings()
  const chords = view?.chords ?? []
  const [now, setNow] = useState<Now>(START)

  useEffect(() => {
    if (!grid) return
    let frame = 0
    let last = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const seconds = audio.position()
      const around = chordsAround(chords, seconds)
      const nextChord = chords[around.index + 1]
      const position = grid.positionAt(seconds)
      // Before the first detected beat the song hasn't started: bar 1, no beat lit.
      const early = position.bar < grid.firstBar
      const bar = early ? grid.firstBar : position.bar
      const barEnd = grid.barEnd(bar)
      const times = grid.beatsOf(bar)
      let changeBeat = -1
      if (nextChord && nextChord.t0 < barEnd - EPS) {
        times.forEach((t, i) => {
          if (t <= nextChord.t0 + EPS) changeBeat = i
        })
      }
      const next: Now = {
        index: around.current ? around.index : -1,
        next: nextChord ? around.index + 1 : -1,
        beats: nextChord ? beatsBetween(grid.grid.times, seconds, nextChord.t0) : 0,
        bar,
        beat: early ? -1 : position.beat - 1,
        beatsInBar: times.length,
        changeBeat,
      }
      const key = JSON.stringify(next)
      if (key !== last) {
        last = key
        setNow(next)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [chords, audio, grid])

  const current = chords[now.index]
  const next = chords[now.next]
  const voicing = voicings[now.index]
  const nextVoicing = voicings[now.next]
  const then = chords.slice(now.next + 1, now.next + 1 + THEN)
  const barNumber = now.bar < 0 ? m['practice.pickup']() : String(now.bar + 1)
  const nextLabel = !next
    ? ''
    : now.beats <= 1
      ? m['practice.next_on_beat']()
      : now.beats <= COUNT_BEATS
        ? m['practice.next_in_beats']({ count: String(now.beats) })
        : m['practice.next_at_bar']({ bar: String(next.bar + 1) })

  return (
    <div
      data-slot="piano-strip"
      className="@container flex min-w-0 flex-1 items-start gap-4 py-1 @3xl:gap-6"
    >
      <div className="flex shrink-0 flex-col items-start gap-2">
        <span className={label}>{m['practice.now_bar']({ bar: barNumber })}</span>
        {current ? (
          chip(current, 'current')
        ) : (
          <span className="inline-flex min-h-target-practice-2 items-center border-2 border-transparent px-3 font-reading text-read-chord-current leading-none font-bold text-conf-medium">
            {m['practice.no_chord_short']()}
          </span>
        )}
        <span aria-hidden className="flex gap-2 px-1">
          {Array.from({ length: now.beatsInBar }, (_, beat) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: beats are positional
              key={beat}
              data-slot="beat-dot"
              className={cn(
                'size-3 rounded-full border-2 transition-[background-color,border-color,scale] duration-(--duration-fast) ease-standard',
                beat === now.beat
                  ? 'scale-115 border-ink bg-ink'
                  : beat === now.changeBeat
                    ? 'border-dashed border-score-loop-edge'
                    : 'border-staff',
              )}
            />
          ))}
        </span>
      </div>

      {/* Always drawn, empty under N.C., so the strip never moves when a chord starts. */}
      <figure className="flex shrink-0 flex-col gap-1.5">
        <KeyboardDiagram
          className="h-[calc(var(--read-chord-current)*2.9)] w-auto"
          left={voicing?.left ?? []}
          right={voicing?.right ?? []}
          label={voicing?.label ?? m['practice.no_chord']()}
          middleC={noteName(60)}
        />
        <figcaption aria-hidden className="flex min-h-[1.4em] gap-4 font-reading text-read-label">
          {voicing && voicing.left.length > 0 && <Hand hand="left" notes={voicing.leftText} />}
          {voicing && <Hand hand="right" notes={voicing.rightText} />}
        </figcaption>
      </figure>

      {next && (
        <>
          <ArrowRightIcon aria-hidden className="size-6 shrink-0 self-center text-staff" />
          <div className="flex shrink-0 flex-col items-start gap-2">
            <span className={label}>{nextLabel}</span>
            {chip(next, 'upcoming')}
            {nextVoicing && (
              <KeyboardDiagram
                className="hidden h-[calc(var(--read-chord)*2.2)] w-auto @4xl:block"
                left={nextVoicing.left}
                right={nextVoicing.right}
                label={nextVoicing.label}
                marks={false}
              />
            )}
          </div>
        </>
      )}

      <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
        {then.length > 0 && (
          <div className="hidden flex-col items-end gap-1 @6xl:flex">
            <span className={label}>{m['practice.then']()}</span>
            <span className="flex gap-4 font-reading text-read-chord font-semibold text-conf-medium">
              {then.map((chord) => (
                <ChordSymbol key={chord.id} name={chord.name} />
              ))}
            </span>
          </div>
        )}
        <PianoOptions />
      </div>
    </div>
  )
}

function Hand({ hand, notes }: { hand: 'left' | 'right'; notes: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          'grid size-[1.4em] place-items-center rounded-md text-[0.8em] font-bold',
          hand === 'left' ? 'bg-key-left text-key-left-fg' : 'bg-key-right text-key-right-fg',
        )}
      >
        {hand === 'left' ? 'L' : 'R'}
      </span>
      {notes}
    </span>
  )
}
