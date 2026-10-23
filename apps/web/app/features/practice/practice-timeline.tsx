import { lazy, Suspense, useMemo } from 'react'
import { m } from '@/lib/i18n'
import type { TimelineLane } from '@/ui/waveform-timeline'
import { barAt } from './model/grid'
import { barRange, nudge } from './model/loops'
import { usePractice } from './practice-context'

// The canvas loads with the first waveform (after the audio is decoded), at the same height.
const WaveformTimeline = lazy(() =>
  import('@/ui/waveform-timeline').then((module) => ({ default: module.WaveformTimeline })),
)

// Timeline (12 §2, 27 §3.7.1): a slim overview of the song above the transport — your part's
// waveform (or the song's own audio before stems), the bar ruler once beats exist (seconds
// before), loop band, unsure-bar hatching and the now-line; the other stems live in the mixer.
// Tap seeks to the bar's downbeat; dragging a loop handle snaps to bars. Phone landscape keeps
// only the compact ruler.

export function PracticeTimeline({ compact = false }: { compact?: boolean }) {
  const practice = usePractice()
  const { lanes, grid, player, view, audio } = practice
  const shown = lanes.filter((lane) => lane.role === 'part')
  const timelineLanes: TimelineLane[] = (shown.length > 0 ? shown : lanes.slice(0, 1)).map(
    (lane) => ({
      id: lane.id,
      label:
        lane.role === 'part'
          ? m['mixer.your_part']()
          : lane.role === 'backing'
            ? m['mixer.backing']()
            : m['mixer.song'](),
      peaks: lane.peaks,
      rms: lane.rms,
    }),
  )
  const bars = useMemo(
    () =>
      grid?.bars.map((bar) => ({
        bar,
        start: grid.barStart(bar),
        label: bar < 0 ? m['practice.pickup']() : String(bar + 1),
      })),
    [grid],
  )
  const unsure = useMemo(
    () =>
      grid && view
        ? [...view.unsureBars].map((bar) => ({ start: grid.barStart(bar), end: grid.barEnd(bar) }))
        : [],
    [grid, view],
  )
  const loop = player.loop
  return (
    <div className="shrink-0 px-4 pt-2 md:px-6">
      <Suspense fallback={<div className={compact ? 'h-8' : 'h-12'} />}>
        <WaveformTimeline
          lanes={timelineLanes}
          blockSeconds={lanes[0]?.blockSeconds ?? 1}
          duration={audio.duration || practice.data.song.data?.duration_s || 1}
          bars={bars}
          loop={loop}
          unsure={unsure}
          position={() => audio.position()}
          compact={compact}
          overview={!compact}
          onSeek={(seconds) =>
            practice.send({
              type: 'SEEK',
              seconds: grid ? grid.barStart(barAt(grid, seconds)) : seconds,
            })
          }
          onNudgeLoop={(edge, direction) => {
            if (grid && loop) practice.setLoop(nudge(grid, loop, edge, direction))
          }}
          onDragLoop={(edge, seconds) => {
            if (!grid || !loop) return
            const bar = barAt(grid, seconds)
            practice.setLoop(
              edge === 'start'
                ? barRange(grid, bar, loop.endBar)
                : barRange(grid, loop.startBar, bar),
            )
          }}
          labels={{
            zoomIn: m['practice.zoom_in'](),
            zoomOut: m['practice.zoom_out'](),
            loopStart: loop
              ? m['practice.loop_start']({ bar: String(loop.startBar + 1) })
              : m['practice.loop'](),
            loopEnd: loop
              ? m['practice.loop_end']({ bar: String(loop.endBar + 1) })
              : m['practice.loop'](),
          }}
        />
      </Suspense>
    </div>
  )
}
