import { useEffect, useMemo, useRef, useState } from 'react'
import { FixSynth } from './fix-synth'
import { chordEvents, chordVoicing, type SynthEvent } from './model/synth-schedule'
import { usePractice } from './practice-context'

// "Hear the chords" (12 §7, 27 §3.7.4): the audition synth (s38) plays every transcribed chord on
// each beat it covers, voiced as the learner would play it, scheduled from the engine's clock and
// played into its helpers input, so it follows loops and speed and goes through the master volume
// and the limiter. Loaded when switched on; Fix mode's own synth takes over while fixing.

export function HearChords() {
  const practice = usePractice()
  const latest = useRef(practice)
  latest.current = practice
  const [synth] = useState(
    () =>
      new FixSynth({
        output: () => {
          const engine = latest.current.audio.engine
          return engine && { context: engine.context, input: engine.input }
        },
        read: () => {
          const { audio, player } = latest.current
          return {
            position: audio.position(),
            rate: player.speedPct / 100,
            playing: audio.playing(),
            loop:
              player.loop && player.loopOn
                ? { start: player.loop.start, end: player.loop.end }
                : null,
          }
        },
      }),
  )
  useEffect(() => () => synth.stop(), [synth])
  const { grid, view, music, data } = practice
  const guitar = data.instrument === 'guitar'
  const capo = music?.tab?.capo ?? 0
  const events = useMemo(() => {
    if (!grid || !view) return []
    const beats = grid.bars.flatMap((bar) => grid.beatsOf(bar))
    return view.chords.flatMap((chord): SynthEvent[] =>
      chordEvents(chordVoicing(chord.label, { bass: chord.bass, guitar, capo }), beats, {
        start: chord.t0,
        end: chord.t1,
      }),
    )
  }, [grid, view, guitar, capo])
  useEffect(() => synth.setEvents(events), [synth, events])
  return null
}
