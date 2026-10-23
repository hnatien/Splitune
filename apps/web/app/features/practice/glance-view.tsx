import { useEffect, useRef, useState } from 'react'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { chordsAround } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// Glance view (26 §6.3, 27 §3.7.2): the phone-portrait default and the Floor distance — current
// and next chord, bar.beat, loop and speed at reading sizes a learner can see from 1.5 m. The
// current chord rises in when it changes; "Loop this bar" is the glance view's way to make a loop.

export function GlanceView() {
  const { view, audio, grid, player, tapBar } = usePractice()
  const [now, setNow] = useState({ chord: '', index: -1, next: '', bar: 0, beat: 1 })
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

  return (
    <section
      aria-label={m['practice.glance']()}
      data-slot="glance-view"
      className="flex flex-1 flex-col items-center justify-center gap-4 bg-paper px-4 py-6 text-ink"
    >
      <p
        key={now.index}
        className="animate-rise-in font-reading text-read-chord-current leading-none"
        aria-live="off"
      >
        {now.chord || m['practice.no_chord']()}
      </p>
      {now.next && (
        <p className="font-reading text-read-chord text-ink">
          <span className="sr-only">{m['practice.next_chord']()} </span>
          {now.next}
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
