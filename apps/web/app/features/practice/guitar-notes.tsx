import {
  FretboardDiagram,
  type FretPosition,
  type FretWindow,
  fitReadPx,
  fretKeys,
  fretWindowAt,
  GuitarRoll,
  type GuitarRollTheme,
  groupAfter,
  labelPx,
  noteGroups,
  STRUM_S,
  soundingNotes,
} from '@splitune/notation'
import { readColor } from '@splitune/ui-tokens'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { meQuery } from '@/lib/session'
import { cn } from '@/lib/utils'
import { ChordSymbol, chordText } from '@/ui/chord-chip'
import { fretNotes, stringNames } from './model/fret-notes'
import { barAt } from './model/grid'
import { chordsAround } from './model/view-model'
import { usePractice } from './practice-context'
import { readScoreTheme, useTokens } from './score-theme'

// Guitar and bass Notes (step 18b, direction A chosen by the owner 2026-10-24): the part in tab
// order on lanes that run on into the strings of a neck at the left, moving right to left onto
// it; the neck lights the fingers sounding now and shows the next shape faintly, re-framing a
// little early when the hand has to move. One bar is in view (a bar of look-ahead, 12 §3), timed
// from the audio clock read once a frame, the same clock as the tab cursor and chord strip; with
// reduced motion the lanes turn a bar at a time and only the playhead moves. A tap on the lanes
// loops bars like a tap on the tab (A then B); the loop panel does the same from the keyboard.
// Loads on its own when shown, outside the route's JS budget (12 §10).

const BARS_IN_VIEW = 1
// The neck's width: a share of the paper's, wider on phones where the lanes have less height.
const NECK = { share: 0.34, phone: 0.38, min: 200, max: 440 }
// Landing acknowledgements: at most three a second across the view (26 §10 flash safety).
const FLASH_GAP_S = 1 / 3
// The screen-reader description changes at most once a second while playing.
const LABEL_EVERY_MS = 1000
// A clock jump this big between frames is a seek: the neck moves at once instead of gliding.
const SEEK_S = 0.25

// The lanes' colours and sizes, and whether motion is reduced (the resolved setting, 26 §10).
const readTheme = (bass: boolean) => (element: HTMLElement) => {
  const score = readScoreTheme(element)
  const roll: GuitarRollTheme = {
    family: score.family,
    tabPx: score.tabPx,
    barNumberPx: score.barNumberPx,
    paper: readColor('--paper', element),
    ink: score.ink.high,
    staff: score.staff,
    playhead: readColor('--score-playhead', element),
    loopFill: readColor('--score-loop-fill', element),
    loopEdge: readColor('--score-loop-edge', element),
    medium: score.ink.medium,
    low: score.ink.low,
    accent: readColor(bass ? '--fret-bass' : '--fret-guitar', element),
  }
  return { roll, reduced: document.documentElement.getAttribute('data-motion') === 'reduce' }
}

interface Now {
  sounding: FretPosition[]
  next: FretPosition[]
  window: FretWindow
  shift: number | undefined
  instant: boolean
  landing: number
  bar: number
  chord: string | undefined
  nextChord: string | undefined
}

export function GuitarNotes({
  className,
  compact = false,
  onBarActivate,
}: {
  className?: string | undefined
  /** Phone landscape: the chord strip gives way, so the chord now sits over the neck. */
  compact?: boolean
  onBarActivate: (bar: number) => void
}) {
  const { music, grid, view, audio, player, data } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const me = useQuery(meQuery)
  const bass = data.instrument === 'bass'
  const [host, setHost] = useState<HTMLElement | null>(null)
  const tokens = useTokens(
    host,
    useMemo(() => readTheme(bass), [bass]),
  )
  const theme = tokens?.roll
  const reduced = tokens?.reduced ?? false
  const [box, setBox] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!box) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 }),
    )
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])

  const tab = music?.tab
  const part = useMemo(
    () => (tab && view && grid ? fretNotes(tab, view, grid.grid) : undefined),
    [tab, view, grid],
  )
  const notes = useMemo(() => part?.notes ?? [], [part])
  const groups = useMemo(() => noteGroups(notes), [notes])
  const longest = useMemo(() => notes.reduce((max, n) => Math.max(max, n.t1 - n.t0), 0), [notes])
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
      // The median bar, so the lanes' speed doesn't jump with small tempo changes.
      span: BARS_IN_VIEW * (lengths[lengths.length >> 1] ?? 2),
      starts: grid.bars.map((bar) => grid.barStart(bar)),
    }
  }, [grid])
  const keys = useMemo(() => (timing ? fretKeys(notes, timing.starts) : []), [notes, timing])
  // Chord names where the chord changes (a simplified level can repeat one).
  const chords = useMemo(
    () =>
      (view?.chords ?? [])
        .filter((c, i, all) => all[i - 1]?.name !== c.name)
        .map((c) => ({ t: c.t0, name: c.name, low: c.confidence === 'low' })),
    [view],
  )
  const loop =
    player.loop && grid
      ? { t0: grid.barStart(player.loop.startBar), t1: grid.barEnd(player.loop.endBar) }
      : null
  const loopT0 = loop?.t0
  const loopT1 = loop?.t1

  // What the neck shows, from the clock once a frame; state changes only when it does.
  const [now, setNow] = useState<Now | undefined>(undefined)
  useEffect(() => {
    if (!grid || !timing) return
    const loopNow = loopT0 !== undefined && loopT1 !== undefined ? { t0: loopT0, t1: loopT1 } : null
    let frame = 0
    let last = Number.NaN
    let previous = ''
    let landing = 0
    let landedAt = Number.NEGATIVE_INFINITY
    let landedGroup = Number.NEGATIVE_INFINITY
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const t = audio.position()
      const jumped = Number.isFinite(last) && Math.abs(t - last) > SEEK_S
      last = t
      const ringing = soundingNotes(notes, t, longest)
      const window = fretWindowAt(keys, t, loopNow)
      const coming = groupAfter(groups, t, loopNow)
      const ahead = coming
        ? coming.t0 >= t
          ? coming.t0 - t
          : (loopNow?.t1 ?? t) - t + coming.t0 - (loopNow?.t0 ?? 0)
        : Number.POSITIVE_INFINITY
      const next = coming && ahead < timing.span ? coming.notes : []
      const shift = next.find((n) => n.fret > 0 && (n.fret < window.lo || n.fret > window.hi))
      // The newest strum sounding now lands once; acknowledged when the last was a third of a
      // second ago or more.
      const newest = ringing.reduce((max, n) => Math.max(max, n.t0), Number.NEGATIVE_INFINITY)
      if (newest > landedGroup + 0.05 || newest < landedGroup - 0.05) {
        landedGroup = newest
        if (Number.isFinite(newest) && t - newest < 0.1 && newest - landedAt >= FLASH_GAP_S) {
          landing++
          landedAt = newest
        }
      }
      const around = chordsAround(view?.chords ?? [], t)
      const sounding = ringing.map((n) => ({
        string: n.string,
        fret: n.fret,
        landed: n.t0 > newest - STRUM_S,
      }))
      const nextPositions = next.map((n) => ({ string: n.string, fret: n.fret }))
      const bar = grid.positionAt(t).bar
      const key = [
        sounding.map((p) => `${p.string}:${p.fret}`).join(),
        nextPositions.map((p) => `${p.string}:${p.fret}`).join(),
        window.lo,
        window.hi,
        shift?.fret,
        landing,
        bar,
        around.current?.name,
        around.next?.name,
      ].join('|')
      if (key === previous) return
      previous = key
      setNow({
        sounding,
        next: nextPositions,
        window,
        shift: shift?.fret,
        instant: jumped,
        landing,
        bar,
        chord: around.current?.name,
        nextChord: around.next?.name,
      })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [audio, grid, timing, notes, groups, keys, longest, view, loopT0, loopT1])

  // The description for screen readers (the canvas is hidden from them): the bar, its chord and
  // the strings and frets sounding, at most once a second while playing.
  const description = useMemo(() => {
    if (!now) return ''
    const notesText =
      now.sounding.length > 0
        ? [...now.sounding]
            .sort((a, b) => a.string - b.string)
            .map((p) =>
              m['practice.fret_position']({ string: String(p.string), fret: String(p.fret) }),
            )
            .join(', ')
        : m['practice.sounding_none']()
    return m['practice.notes_now']({
      bar: now.bar < 0 ? m['practice.pickup']() : m['practice.bar']({ bar: String(now.bar + 1) }),
      chord: now.chord ? chordText(now.chord) : m['practice.no_chord'](),
      notes: notesText,
    })
  }, [now])
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!audio.playing()) {
      setLabel(description)
      return
    }
    const timer = setTimeout(() => setLabel(description), LABEL_EVERY_MS)
    return () => clearTimeout(timer)
  }, [description, audio])

  if (!grid || !timing || !tab || !music) return null
  const names = stringNames(tab.tuningMidi, music.noteNames).map(chordText)
  const { width, height } = size
  // Fret digits at the reading size unless the paper is too short for it (a phone in landscape,
  // where the Floor distance's sizes are the glance view's); labels follow them.
  const fit = Math.max(12, fitReadPx(height, tab.tuningMidi.length))
  const sized = theme && {
    ...theme,
    tabPx: Math.min(theme.tabPx, fit),
    barNumberPx: Math.min(theme.barNumberPx, labelPx(Math.min(theme.tabPx, fit))),
  }
  const neck = Math.round(
    Math.min(NECK.max, Math.max(NECK.min, width * (compact ? NECK.phone : NECK.share))),
  )
  return (
    <section
      ref={setHost}
      aria-label={m['practice.view_notes']()}
      data-slot="guitar-notes"
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-paper px-4 pt-1 pb-2 font-reading text-read-bar-number text-ink motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter md:px-8',
        className,
      )}
    >
      <div ref={setBox} className="relative mx-auto flex min-h-0 w-full max-w-page flex-1">
        {sized && height > 0 && now && (
          <FretboardDiagram
            className="shrink-0"
            names={names}
            window={now.window}
            width={neck}
            height={height}
            readPx={sized.tabPx}
            numberPx={sized.barNumberPx}
            sounding={now.sounding}
            next={now.next}
            shift={
              now.shift === undefined
                ? undefined
                : { fret: now.shift, label: m['practice.fret_shift']({ fret: String(now.shift) }) }
            }
            capo={tab.capo}
            mirrored={me.data?.handedness === 'left'}
            instant={now.instant}
            landing={reduced ? undefined : now.landing}
            accent={bass ? 'var(--fret-bass)' : 'var(--fret-guitar)'}
            label={label || description}
          />
        )}
        {sized && (
          <GuitarRoll
            className="min-h-0 min-w-0 flex-1 cursor-pointer"
            notes={notes}
            strings={tab.tuningMidi.length}
            clock={() => audio.position()}
            span={timing.span}
            bars={timing.bars}
            beats={timing.beats}
            chords={chords}
            markers={part?.markers ?? []}
            loop={loop}
            page={reduced ? (t) => grid.barStart(barAt(grid, t)) : undefined}
            showUncertainty={showUncertainty}
            theme={sized}
            onTimeActivate={(t) => onBarActivate(barAt(grid, t))}
          />
        )}
        {compact && sized && now?.chord && (
          <p
            aria-hidden
            data-slot="notes-chord"
            className="pointer-events-none absolute top-0 left-0 flex items-baseline gap-2 leading-none font-semibold"
            style={{ fontSize: sized.tabPx }}
          >
            <ChordSymbol name={now.chord} />
            {now.nextChord && (
              <span className="text-[0.7em] text-conf-medium">
                → <ChordSymbol name={now.nextChord} />
              </span>
            )}
          </p>
        )}
      </div>
    </section>
  )
}
