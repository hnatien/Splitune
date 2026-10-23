import type { PianoNote } from '@splitune/music-core'
import {
  KeyboardDiagram,
  keyboardKeys,
  PianoRoll,
  type RollTheme,
  rollRange,
  soundingNotes,
} from '@splitune/notation'
import { readColor, type TokenName } from '@splitune/ui-tokens'
import { useEffect, useMemo, useState } from 'react'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { chordText } from '@/ui/chord-chip'
import { barAt } from './model/grid'
import { noteName } from './model/view-model'
import { usePractice } from './practice-context'
import { useTokens } from './score-theme'

// Piano's Notes view (21 V4; ux/music-display-ui "keep the roll aligned to the keys"): the
// transcribed notes fall onto a keyboard that lights the keys sounding now, hands by lightness
// and L/R. Two bars are in view above the keyboard, a bar of look-ahead at least (12 §3); with
// reduced motion the roll turns a bar at a time and only the playhead moves. A click on the roll
// loops bars like a tap on the chart (A then B); the loop panel does the same from the keyboard.
// Loads on its own when shown, outside the route's JS budget (12 §10).

const BARS_IN_VIEW = 2
// The keyboard's height in px, a share of its width, so a wide roll keeps most of the paper, and
// never more than a share of the paper's height (phones in landscape have little of it).
const KEYS_PX = { min: 56, max: 112, share: 0.09, ofHeight: 0.4 }
// White keys between 1.2 and 4.8 times as long as they are wide.
const KEY_LENGTH = { min: 12, max: 48 }

function readRollTheme(element: HTMLElement): RollTheme {
  const token = (name: TokenName) => readColor(name, element)
  const style = getComputedStyle(element)
  return {
    family: style.fontFamily,
    barNumberPx: Number.parseFloat(style.fontSize) || 14,
    ink: token('--ink'),
    staff: token('--staff'),
    playhead: token('--score-playhead'),
    loopFill: token('--score-loop-fill'),
    loopEdge: token('--score-loop-edge'),
    barLabel: token('--conf-medium'),
    medium: token('--conf-medium'),
    low: token('--conf-low'),
    left: token('--key-left'),
    leftFg: token('--key-left-fg'),
    right: token('--key-right'),
    rightFg: token('--key-right-fg'),
  }
}

export function PianoNotes({
  className,
  onBarActivate,
}: {
  className?: string | undefined
  onBarActivate: (bar: number) => void
}) {
  const { music, grid, audio, player } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const hands = usePracticeDefaults((s) => s.pianoHands)
  const motion = useDisplay((s) => s.motion)
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const reduced = motion === 'reduce' || (motion === 'system' && systemReduce)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const theme = useTokens(host, readRollTheme)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!host) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 }),
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [host])
  const notes = music?.piano?.notes
  const all = useMemo(() => notes ?? [], [notes])
  const range = useMemo(() => rollRange(all.map((n) => n.pitch)), [all])
  const longest = useMemo(() => all.reduce((max, n) => Math.max(max, n.t1 - n.t0), 0), [all])
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
      // The median bar, so the roll's speed doesn't jump with small tempo changes.
      span: BARS_IN_VIEW * (lengths[lengths.length >> 1] ?? 2),
    }
  }, [grid])

  const [sounding, setSounding] = useState<PianoNote[]>([])
  useEffect(() => {
    let frame = 0
    let last = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const now = soundingNotes(all, audio.position(), longest)
      const key = now.map((n) => n.id).join()
      if (key !== last) {
        last = key
        setSounding(now)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [all, longest, audio])

  if (!grid || !timing) return null
  const loop = player.loop
  const units = keyboardKeys(range.from, range.to).width + 1
  const { width, height } = size
  const keysPx = Math.min(
    KEYS_PX.max,
    Math.max(KEYS_PX.min, width * KEYS_PX.share),
    height * KEYS_PX.ofHeight,
  )
  const keyLength =
    width > 0
      ? Math.min(KEY_LENGTH.max, Math.max(KEY_LENGTH.min, (keysPx * units) / width))
      : KEY_LENGTH.max
  // Each hand low to high, as read on the keys.
  const pitches = (hand: 'left' | 'right') =>
    sounding
      .filter((n) => n.hand === hand)
      .map((n) => n.pitch)
      .sort((a, b) => a - b)
  const left = hands === 'both' ? pitches('left') : []
  const right = pitches('right')
  // Named in the song's key (E♭4, not D#4), as on the strip's keyboard.
  const spelled = (p: number) =>
    music?.noteNames
      ? `${chordText(music.noteNames[p % 12] ?? '')}${Math.floor(p / 12) - 1}`
      : noteName(p)
  const names = (pitches: number[]) => pitches.map(spelled).join(' ')
  const parts = [
    left.length > 0 && `${m['practice.hand_left']()} ${names(left)}`,
    right.length > 0 && `${m['practice.hand_right']()} ${names(right)}`,
  ].filter(Boolean)
  return (
    <section
      ref={setHost}
      aria-label={m['practice.view_notes']()}
      data-slot="piano-notes"
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-paper px-4 pt-2 pb-3 font-reading text-read-bar-number text-ink motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter md:px-8',
        className,
      )}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-page flex-1 flex-col">
        {theme && (
          <PianoRoll
            className="min-h-0 w-full flex-1 cursor-pointer"
            notes={all}
            from={range.from}
            to={range.to}
            clock={() => audio.position()}
            span={timing.span}
            bars={timing.bars}
            beats={timing.beats}
            loop={loop ? { t0: grid.barStart(loop.startBar), t1: grid.barEnd(loop.endBar) } : null}
            page={reduced ? (t) => grid.barStart(barAt(grid, t)) : undefined}
            showUncertainty={showUncertainty}
            dim={hands === 'right' ? 'left' : undefined}
            theme={theme}
            label={m['practice.falling_notes']()}
            onTimeActivate={(t) => onBarActivate(barAt(grid, t))}
          />
        )}
        <KeyboardDiagram
          className="h-auto w-full shrink-0"
          from={range.from}
          to={range.to}
          left={left}
          right={right}
          label={
            parts.length > 0
              ? m['practice.sounding']({ notes: parts.join(', ') })
              : m['practice.sounding_none']()
          }
          middleC={noteName(60)}
          height={keyLength}
        />
      </div>
    </section>
  )
}
