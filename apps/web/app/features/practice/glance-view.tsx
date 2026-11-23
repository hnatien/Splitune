import { KeyboardDiagram } from '@splitune/notation'
import { RepeatIcon } from 'lucide-react'
import { type CSSProperties, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { ChordSymbol } from '@/ui/chord-chip'
import { ChordShape } from './chord-shape'
import { running } from './model/getting-ready'
import { chordsAround, noteName } from './model/view-model'
import { usePianoVoicings } from './piano-voicing'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The analysis' decisions load only while there is one to show (12 §10 route budget).
const GettingReady = lazy(() =>
  import('./getting-ready').then((module) => ({ default: module.GettingReady })),
)

// Glance view (26 §6.3, 27 §3.7.2): a phone's Chords view, read from the music stand. From the
// top: what the analysis needs from the learner, if anything (the part question, a failure, the
// queued line), then "Now · bar 6.2" over the current chord at the largest reading size with its
// guitar shape (for piano, its voicing on a keyboard), "Next" over the next chord a size down,
// and one line for the loop and the speed with "Loop this bar". The current chord rises in when
// it changes and a long name (or "No chord") shrinks to fit the width (the fit rule, 26 §6.3).
// Everything stays inside its own region and scrolls there if a large reading size needs it, so
// nothing runs into the song map or the transport.

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

  const analysis = data.analysis.data
  const analysing = running(analysis) || analysis?.status === 'failed'
  const voicing = voicings[now.index]
  const name = now.chord || m['practice.no_chord']()
  const where = !grid
    ? ''
    : now.bar < 0
      ? m['practice.pickup']()
      : m['practice.now_bar']({ bar: `${now.bar + 1}.${now.beat}` })
  return (
    <section
      aria-label={m['practice.glance']()}
      data-slot="glance-view"
      className="@container flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-paper px-4 pt-3 pb-4 text-ink"
    >
      {analysing && (
        <Suspense fallback={null}>
          <GettingReady compact />
        </Suspense>
      )}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 py-4">
        <div className="flex flex-col gap-1">
          {where && <p className="text-read-label text-muted-foreground tabular-nums">{where}</p>}
          <div key={now.index} className="flex max-w-full animate-rise-in items-center gap-5">
            <p
              data-slot="glance-now"
              style={
                { '--fit': `calc(100cqi / ${Math.max(2, name.length) * 0.62})` } as CSSProperties
              }
              className="min-w-0 font-reading text-[length:min(var(--read-chord-current),var(--fit))] leading-none font-medium whitespace-nowrap"
              aria-live="off"
            >
              {now.chord ? <ChordSymbol name={now.chord} /> : m['practice.no_chord']()}
            </p>
            {now.label && data.instrument === 'guitar' && (
              <ChordShape
                className="aspect-[60/72] h-[min(calc(var(--read-chord-current)*0.9),30cqi)] shrink-0 text-ink"
                label={now.label}
                name={now.chord}
                capo={options.capo}
              />
            )}
          </div>
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
          <div data-slot="glance-next" className="flex flex-col gap-1">
            <p className="text-read-label text-muted-foreground">{m['practice.next_chord']()}</p>
            <p className="font-reading text-read-chord-next leading-none font-medium">
              <ChordSymbol name={now.next} />
            </p>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
        <p className="text-read-label tabular-nums">
          {player.loop
            ? `${m['practice.loop_bars']({
                bars: `${player.loop.startBar + 1}–${player.loop.endBar + 1}`,
              })} · `
            : ''}
          {formatPercent(player.speedPct)}
        </p>
        {grid && !player.loop && (
          <Button
            variant="outline"
            size="practice"
            onClick={() => {
              usePracticeUi.setState({ selection: { kind: 'none' } })
              tapBar(now.bar)
              tapBar(now.bar)
            }}
          >
            <RepeatIcon aria-hidden />
            {m['practice.loop_this_bar']()}
          </Button>
        )}
      </div>
    </section>
  )
}
