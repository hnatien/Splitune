import { KeyboardDiagram } from '@splitune/notation'
import { useEffect, useRef, useState } from 'react'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { ChordSymbol } from '@/ui/chord-chip'
import { ChordShape } from './chord-shape'
import { chordsAround, noteName } from './model/view-model'
import { usePianoVoicings } from './piano-voicing'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// Glance view (26 §6.3, 27 §3.7.2): the phone-portrait default and the Floor distance — current
// chord with its guitar shape (for piano, its voicing on a keyboard below it), next chord,
// bar.beat, loop and speed at reading sizes a learner can see from 1.5 m. The current chord rises
// in when it changes; "Loop this bar" is the glance view's way to make a loop.

export function GlanceView() {
  const { view, audio, grid, player, tapBar, data, options } = usePractice()
  const voicings = usePianoVoicings()
  const [now, setNow] = useState({ chord: '', label: '', index: -1, next: '', bar: 0, beat: 1 })
  const last = useRef('')
  useEffect(() => {
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const seconds = audio.position()
      const around = chordsAround(view?.chords ?? [], seconds)
      const at = grid?.positionAt(seconds) ?? { bar: 0, beat: 1 }
      const next = {
        chord: around.current?.name ?? '',
        label: around.current?.label ?? '',
        index: around.current ? around.index : -1,
        next: around.next?.name ?? '',
        bar: at.bar,
        beat: at.beat,
      }
      const key = JSON.stringify(next)
      if (key !== last.current) {
        last.current = key
        setNow(next)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [audio, grid, view])

  const voicing = voicings[now.index]
  return (
    <section
      aria-label={m['practice.glance']()}
      data-slot="glance-view"
      className="flex flex-1 flex-col items-center justify-center gap-4 bg-paper px-4 py-6 text-ink"
    >
      <div key={now.index} className="flex animate-rise-in items-center gap-5">
        <p className="font-reading text-read-chord-current leading-none" aria-live="off">
          {now.chord ? <ChordSymbol name={now.chord} /> : m['practice.no_chord']()}
        </p>
        {now.label && data.instrument === 'guitar' && (
          <ChordShape
            className="aspect-[60/72] h-[calc(var(--read-chord-current)*0.9)] shrink-0 text-ink"
            label={now.label}
            name={now.chord}
            capo={options.capo}
          />
        )}
      </div>
      {data.instrument === 'piano' && (
        <KeyboardDiagram
          className="h-auto w-full max-w-reading"
          left={voicing?.left ?? []}
          right={voicing?.right ?? []}
          label={voicing?.label ?? m['practice.no_chord']()}
          middleC={noteName(60)}
        />
      )}
      {now.next && (
        <p className="font-reading text-read-chord text-ink">
          <span className="sr-only">{m['practice.next_chord']()} </span>
          <ChordSymbol name={now.next} />
        </p>
      )}
      {grid && (
        <p className="font-reading text-read-bar-number tabular-nums">
          {now.bar < 0
            ? m['practice.pickup']()
            : m['practice.bar_beat']({ bar: String(now.bar + 1), beat: String(now.beat) })}
        </p>
      )}
      <p className="text-read-readout tabular-nums">
        {player.loop
          ? m['practice.loop_bars']({
              bars: `${player.loop.startBar + 1}–${player.loop.endBar + 1}`,
            })
          : null}
        {player.loop ? ' · ' : ''}
        {formatPercent(player.speedPct)}
      </p>
      {grid && !player.loop && (
        <Button
          variant="outline"
          size="practice-2"
          onClick={() => {
            usePracticeUi.setState({ selection: { kind: 'none' } })
            tapBar(now.bar)
            tapBar(now.bar)
          }}
        >
          {m['practice.loop_this_bar']()}
        </Button>
      )}
    </section>
  )
}
