import { MelodyRoll, type MelodyRollTheme, phraseIndexAt } from '@splitune/notation'
import { readColor } from '@splitune/ui-tokens'
import { useEffect, useMemo, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { chordText } from '@/ui/chord-chip'
import { barAt } from './model/grid'
import { spelledNote } from './model/view-model'
import { phraseBars } from './phrase-strip'
import { usePractice } from './practice-context'
import { readScoreTheme, useTokens } from './score-theme'

// Vocals' Melody view (step 18c, mockup and owner's go-ahead 2026-10-24): the sung notes as a
// horizontal roll with phrase markers that need no lyrics (MelodyRoll), under the phrase strip.
// About two bars are ahead of the now line, timed from the audio clock read once a frame; with
// reduced motion the roll turns a page at a time and only the playhead moves. A tap on the notes
// loops bars like a tap on the tab (A then B); a tap on a phrase marker loops that phrase, as L
// does from the keyboard. Loads on its own when shown, outside the route's JS budget (12 §10).

const BARS_AHEAD = 2
// The screen-reader description changes at most once a second while playing.
const LABEL_EVERY_MS = 1000

const readTheme = (element: HTMLElement) => {
  const score = readScoreTheme(element)
  const roll: MelodyRollTheme = {
    family: score.family,
    readPx: score.tabPx,
    barNumberPx: score.barNumberPx,
    paper: readColor('--paper', element),
    ink: score.ink.high,
    staff: score.staff,
    playhead: readColor('--score-playhead', element),
    loopFill: readColor('--score-loop-fill', element),
    loopEdge: readColor('--score-loop-edge', element),
    barCurrent: readColor('--bar-current', element),
    medium: score.ink.medium,
    low: score.ink.low,
    accent: readColor('--melody-vocals', element),
  }
  return { roll, reduced: document.documentElement.getAttribute('data-motion') === 'reduce' }
}

interface Now {
  phrase: number
  bar: number
  sung: number
}

export function VocalMelody({
  className,
  onBarActivate,
}: {
  className?: string | undefined
  onBarActivate: (bar: number) => void
}) {
  const { music, grid, view, audio, player, loopPhrase } = usePractice()
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const labels = usePracticeDefaults((s) => s.melodyLabels)
  const pitchWindow = usePracticeDefaults((s) => s.melodyWindow)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const tokens = useTokens(host, readTheme)
  const melody = music?.melody

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
      span: BARS_AHEAD * (lengths[lengths.length >> 1] ?? 2),
    }
  }, [grid])
  const chords = useMemo(
    () =>
      (view?.chords ?? [])
        .filter((c, i, all) => all[i - 1]?.name !== c.name)
        .map((c) => ({ t: c.t0, name: c.name, low: c.confidence === 'low' })),
    [view],
  )
  const phrases = useMemo(
    () =>
      (melody?.phrases ?? []).map((p, i) => ({
        t0: p.t0,
        t1: p.t1,
        label: `${i + 1} · ${p.letter}${p.repeat ? '′' : ''}  ${phraseBars(p.startBar, p.endBar)}`,
      })),
    [melody],
  )
  const pitchNames = useMemo(() => (music?.noteNames ?? []).map(chordText), [music])

  // What the description says, from the clock once a frame; state changes only when it does.
  const [now, setNow] = useState<Now>({ phrase: -1, bar: 0, sung: -1 })
  useEffect(() => {
    if (!grid || !melody) return
    let frame = 0
    let previous = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const t = audio.position()
      const index = phraseIndexAt(melody.phrases, t)
      const phrase = melody.phrases[index]
      const inside = phrase !== undefined && t <= phrase.t1
      let sung = -1
      for (let i = phrase?.from ?? 0; inside && phrase && i <= phrase.to; i++) {
        const note = melody.notes[i]
        if (note && note.t0 <= t && note.t1 > t && note.band !== 'low') sung = note.pitch
      }
      const next: Now = { phrase: inside ? index : -1, bar: grid.positionAt(t).bar, sung }
      const key = `${next.phrase}|${next.bar}|${next.sung}`
      if (key === previous) return
      previous = key
      setNow(next)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [audio, grid, melody])

  // The description for screen readers (the canvas is hidden from them): the phrase, the bar and
  // the note being sung, at most once a second while playing.
  const description = useMemo(() => {
    const phrase = melody?.phrases[now.phrase]
    return m['practice.melody_now']({
      phrase: phrase
        ? m['practice.phrase_name']({
            n: String(now.phrase + 1),
            letter: `${phrase.letter}${phrase.repeat ? '′' : ''}`,
          })
        : m['practice.phrase_rest'](),
      bar: now.bar < 0 ? m['practice.pickup']() : m['practice.bar']({ bar: String(now.bar + 1) }),
      note:
        now.sung >= 0 && music
          ? m['practice.singing']({ note: spelledNote(now.sung, music.noteNames) })
          : m['practice.singing_none'](),
    })
  }, [now, melody, music])
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!audio.playing()) {
      setLabel(description)
      return
    }
    const timer = setTimeout(() => setLabel(description), LABEL_EVERY_MS)
    return () => clearTimeout(timer)
  }, [description, audio])

  if (!grid || !timing || !melody) return null
  const loop = player.loop
    ? { t0: grid.barStart(player.loop.startBar), t1: grid.barEnd(player.loop.endBar) }
    : null
  return (
    <section
      ref={setHost}
      aria-label={m['practice.view_melody']()}
      data-slot="vocal-melody"
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-paper px-2 pt-1 pb-2 font-reading text-read-bar-number text-ink motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--duration-base) motion-safe:ease-enter md:px-6',
        className,
      )}
    >
      <div
        role="img"
        aria-label={label || description}
        className="mx-auto flex min-h-0 w-full max-w-page flex-1"
      >
        {tokens && (
          <MelodyRoll
            className="min-h-0 min-w-0 flex-1 cursor-pointer"
            notes={melody.notes}
            phrases={phrases}
            clock={() => audio.position()}
            span={timing.span}
            bars={timing.bars}
            beats={timing.beats}
            chords={chords}
            loop={loop}
            page={tokens.reduced ? (t) => grid.barStart(barAt(grid, t)) : undefined}
            scale={melody.scale}
            pitchNames={pitchNames}
            labels={labels}
            window={pitchWindow}
            showUncertainty={showUncertainty}
            theme={tokens.roll}
            onTimeActivate={(t) => onBarActivate(barAt(grid, t))}
            onPhraseActivate={loopPhrase}
          />
        )}
      </div>
    </section>
  )
}
