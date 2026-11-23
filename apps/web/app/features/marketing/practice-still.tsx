import { ChevronLeftIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react'
import { lazy, Suspense, useMemo } from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CountInIcon } from '@/ui/icons'
import { LoopBadge } from '@/ui/loop-badge'
import { PassControl } from '@/ui/pass-control'
import { SpeedControl } from '@/ui/speed-control'
import { StemRow } from '@/ui/stem-row'
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'
import { TransportButton } from '@/ui/transport-button'
import type { TimelineBar, TimelineLane } from '@/ui/waveform-timeline'
import { Still, TabStill } from './product-still'

// The practice screen as Home's hero and How it works' last picture (27 §3.1, s47 direction §1:
// "the product is the hero"), drawn with the real kit and fixture data: the top bar, the song map,
// the tab with its chords, loop band, playhead and unsure marks, the Mix panel beside it on wide
// screens, and the transport with Play as its one filled control and the key caps printed on the
// controls. It is a picture (inert, one text alternative for the whole), so nothing in it can be
// focused or pressed. The tab shows as many bars as stay at reading size: two on a phone, four on
// a tablet, five on a desktop. The song map loads on demand, like practice's, to keep it out
// of the landing page's first load.

const WaveformTimeline = lazy(() =>
  import('@/ui/waveform-timeline').then((module) => ({ default: module.WaveformTimeline })),
)

const noop = () => undefined

// The example riff: 48 bars at 100 BPM, 2.4 s a bar, bars 5–8 looped, the playhead in bar 7.
const BAR_S = 2.4
const BARS = 48
const DURATION = BARS * BAR_S
const LOOP = { start: 4 * BAR_S, end: 8 * BAR_S }
const POSITION = 6.3 * BAR_S
const BLOCK_S = 0.05

function lane(id: string, label: string, level: (t: number) => number): TimelineLane {
  const blocks = Math.ceil(DURATION / BLOCK_S)
  const peaks = new Float32Array(blocks * 2)
  const rms = new Float32Array(blocks)
  for (let b = 0; b < blocks; b += 1) {
    const value = level(b * BLOCK_S)
    peaks[2 * b] = -value
    peaks[2 * b + 1] = value
    rms[b] = value * 0.55
  }
  return { id, label, peaks, rms }
}

/** A plucked part that swells into the chorus at bar 17 and thins for the outro. */
const partLevel = (t: number) => {
  const bar = t / BAR_S
  const section = bar < 4 ? 0.45 : bar < 16 ? 0.7 : bar < 40 ? 0.95 : 0.55
  return section * (0.35 + 0.65 * Math.exp(-5 * ((t % (BAR_S / 4)) / BAR_S)))
}

const TIMELINE_BARS: TimelineBar[] = Array.from({ length: BARS }, (_, bar) => ({
  bar,
  start: bar * BAR_S,
  label: String(bar + 1),
}))

function SongMap() {
  const lanes = useMemo(() => [lane('guitar', m['mixer.your_part'](), partLevel)], [])
  return (
    <div className="border-b border-border px-3 pt-2 pb-1.5 sm:px-4">
      <Suspense fallback={<div className="h-10" />}>
        <WaveformTimeline
          lanes={lanes}
          duration={DURATION}
          bars={TIMELINE_BARS}
          loop={LOOP}
          position={() => POSITION}
          onSeek={noop}
          labels={{
            loopStart: m['practice.loop_start']({ bar: '5' }),
            loopEnd: m['practice.loop_end']({ bar: '8' }),
          }}
        />
      </Suspense>
    </div>
  )
}

const STEMS = [
  { stem: 'guitar', name: () => m['instrument.guitar'](), gain: 3, part: true },
  { stem: 'bass', name: () => m['instrument.bass'](), gain: -6, part: false },
] as const

/** The Mix panel: your part loud, the bass under it. */
function MixPanel() {
  const labels = {
    mute: m['mixer.mute'](),
    solo: m['mixer.solo'](),
    volume: m['mixer.volume'](),
    decrease: m['mixer.quieter'](),
    increase: m['mixer.louder'](),
    muted: m['mixer.muted'](),
    soloed: m['mixer.soloed'](),
  }
  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-border bg-panel max-xl:hidden">
      <div className="flex min-h-13 items-center px-4">
        <span className="text-title">{m['practice.tab_mix']()}</span>
      </div>
      <div className="flex flex-col gap-0.5 px-2 pb-3">
        {STEMS.map(({ stem, name, gain, part }) => (
          <StemRow
            key={stem}
            stem={stem}
            name={name()}
            yourPart={part ? m['mixer.your_part']() : undefined}
            muted={false}
            soloed={false}
            gainDb={gain}
            onMutedChange={noop}
            onSoloedChange={noop}
            onGainChange={noop}
            labels={labels}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The tab at reading size for the width it has (fret digits stay at 12 px or more): bars 7–8 on a
 * phone, 5–8 from `sm`, and 4–8 from `lg` where the picture is `wide` (Home's hero).
 */
export function ReadingTab({
  loop = true,
  playhead,
  wide = false,
}: {
  loop?: boolean
  playhead?: number | null
  wide?: boolean
}) {
  return (
    <>
      <TabStill bars={{ from: 7, to: 8 }} loop={loop} playhead={playhead} className="sm:hidden" />
      <TabStill
        bars={{ from: 5, to: 8 }}
        loop={loop}
        playhead={playhead}
        className={cn('max-sm:hidden', wide && 'lg:hidden')}
      />
      {wide && (
        <TabStill
          bars={{ from: 4, to: 8 }}
          loop={loop}
          playhead={playhead}
          className="max-lg:hidden"
        />
      )}
    </>
  )
}

/**
 * The practice transport: Play (the one filled control) between the bar steps, the position, the
 * loop line or, after a looped pass, the pass prompt in its place, then count-in and speed. It
 * answers to its own width, not the window's (the still is narrower than the page): where one row
 * can't hold the loop line whole, the loop takes a status row above, as on a narrow practice
 * screen, and the position, count-in and bar steps drop out as the width shrinks.
 */
export function StillTransport({ after = 'loop' }: { after?: 'loop' | 'pass' }) {
  const speed = 70
  return (
    <div
      data-slot="still-transport"
      className="@container border-t border-border px-2 py-2 max-sm:[&_[data-slot=kbd]]:hidden sm:px-3"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex items-center gap-1">
          <TransportButton
            icon={<SkipBackIcon aria-hidden />}
            label={m['practice.previous_bar']()}
            showLabel={false}
            shortcut="←"
            className="@max-md:hidden"
          />
          <TransportButton
            tone="primary"
            icon={<PlayIcon aria-hidden />}
            label={m['practice.play']()}
            showLabel={false}
            shortcut={m['practice.key_space']()}
          />
          <TransportButton
            icon={<SkipForwardIcon aria-hidden />}
            label={m['shortcuts.next']()}
            showLabel={false}
            shortcut="→"
            className="@max-md:hidden"
          />
          <span className="flex w-24 flex-col px-2 @max-2xl:hidden">
            <span className="text-title tabular-nums">
              7.3<span className="text-body-sm text-muted-foreground"> / {BARS}</span>
            </span>
            <span className="text-caption text-muted-foreground tabular-nums">0:15 / 1:55</span>
          </span>
        </div>
        <div
          className={cn(
            'flex min-w-0 flex-1 justify-center @max-5xl:order-first @max-5xl:basis-full @max-5xl:justify-start',
            // The pass prompt and its answers take the status row, as on a narrow practice screen.
            after === 'pass' && 'order-first basis-full justify-start border-b border-border pb-2',
          )}
        >
          {after === 'loop' ? (
            <LoopBadge
              state="active"
              shortcut="L"
              detail={`${m['practice.loop_pass']({ pass: '3' })} · ${m['practice.loop_rest_beat']()}`}
              className="max-w-full"
            >
              {m['practice.loop_badge']({ bars: '5–8' })}
            </LoopBadge>
          ) : (
            <PassControl
              labels={{
                prompt: m['practice.pass_rate'](),
                clean: m['practice.felt_clean'](),
                notYet: m['practice.not_yet'](),
              }}
              best={m['practice.best_tempo']({ pct: String(speed) })}
              shortcuts={{ notYet: 'N', clean: 'C' }}
              onClean={noop}
              onNotYet={noop}
            />
          )}
        </div>
        <div className="flex items-center gap-1 @max-5xl:ml-auto">
          <TransportButton
            icon={<CountInIcon aria-hidden />}
            label={m['practice.count_in']()}
            showLabel={false}
            shortcut="I"
            pressed
            className="@max-xl:hidden"
          />
          <SpeedControl
            compact
            value={speed}
            bpm={100}
            onValueChange={noop}
            inlinePresets={false}
            labels={{
              speed: m['practice.speed'](),
              decrease: m['shortcuts.slower'](),
              increase: m['shortcuts.faster'](),
              presets: m['practice.speed_presets'](),
            }}
            shortcuts={{ decrease: ',', increase: '.', open: 'S' }}
          />
        </div>
      </div>
    </div>
  )
}

/** The whole practice screen, framed, with one text alternative. */
export function PracticeStill({ className }: { className?: string }) {
  return (
    <Still
      label={m['home.still_label']()}
      className={cn('rounded-panel border border-border bg-background', className)}
    >
      <div className="flex min-h-13 items-center gap-2 border-b border-border px-2 sm:px-3">
        <span className="grid size-10 shrink-0 place-items-center text-muted-foreground">
          <ChevronLeftIcon aria-hidden className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-label">{m['home.still_title']()}</span>
          <span className="truncate text-caption text-muted-foreground">
            {m['home.still_meta']()}
          </span>
        </span>
        <Tabs value="tab" className="max-sm:hidden">
          <TabsList look="pill">
            <TabsTrigger value="tab">{m['practice.view_tab']()}</TabsTrigger>
            <TabsTrigger value="chords">{m['practice.chords']()}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <SongMap />
      <div className="flex">
        <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-4 sm:px-4 sm:py-8">
          <ReadingTab wide />
        </div>
        <MixPanel />
      </div>
      <StillTransport />
    </Still>
  )
}
