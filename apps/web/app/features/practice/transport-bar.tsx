import {
  MetronomeIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SkipBackIcon,
  SlidersVerticalIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react'
import { lazy, Suspense, useRef } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CountInIcon } from '@/ui/icons'
import { LoopBadge, type LoopState } from '@/ui/loop-badge'
import { PassControl } from '@/ui/pass-control'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { Slider } from '@/ui/slider'
import { SpeedControl } from '@/ui/speed-control'
import { TransportButton } from '@/ui/transport-button'
import type { PracticeLayout } from './layout'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The loop's options and the narrow dock's volume load on first open (12 §10 route budget).
const LoopPanel = lazy(() =>
  import('./loop-panel').then((module) => ({ default: module.LoopPanel })),
)
const VolumePanel = lazy(() =>
  import('./volume-panel').then((module) => ({ default: module.VolumePanel })),
)

// TransportBar (12 §2, 27 §3.7.2): tablets and phones keep today's arrangement until s43, on the
// Night Rehearsal tokens: restart and a large round play; the loop toggle joined to the loop pill
// (which opens the loop's options); speed −/+ around "70 % · 84 BPM"; count-in, metronome and the
// mixer; master volume; and at the right edge the pass pair (Felt clean / Not yet, 64 px) with the
// question after each pass. The controls wrap among themselves when the bar is narrow. Desktop has
// the transport dock (transport-dock.tsx).

const PLAYING = new Set(['countIn', 'playing', 'loopRest', 'assess', 'audition'])

/** The loop pill's state and words (27 §3.7.1): "Loop · bars 25–28" / "pass 2 · rest 1 beat"; off
 * "No loop" / "tap two bars, or a section"; armed "Loop · from bar 17, tap the last bar". */
export function useLoopPill(): { state: LoopState; text: string; detail?: string } {
  const { player, state, layers, ladder } = usePractice()
  const selection = usePracticeUi((s) => s.selection)
  const loop = player.loop
  if (selection.kind === 'armed') {
    return { state: 'armed', text: m['practice.loop_armed']({ bar: String(selection.bar + 1) }) }
  }
  if (!loop) {
    return { state: 'off', text: m['practice.loop_off'](), detail: m['practice.loop_off_hint']() }
  }
  const text = m['practice.loop_badge']({ bars: `${loop.startBar + 1}–${loop.endBar + 1}` })
  const detail = !player.loopOn
    ? m['practice.hud_loop_off']()
    : [
        ladder
          ? m['practice.loop_pass_ladder']({
              pass: String(ladder.pass),
              of: String(ladder.of),
              speed: formatPercent(ladder.speedPct),
            })
          : player.pass > 0
            ? m['practice.loop_pass']({ pass: String(player.pass) })
            : '',
        player.rest === 'beat'
          ? m['practice.loop_rest_beat']()
          : player.rest === 'bar'
            ? m['practice.loop_rest_bar']()
            : '',
        !layers.stems && !ladder && player.pass === 0 && player.rest === 'none'
          ? m['practice.loop_original']()
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
  return {
    state: !player.loopOn
      ? 'off'
      : state === 'loopRest' || state === 'assess'
        ? 'resting'
        : 'active',
    text,
    ...(detail ? { detail } : {}),
  }
}

export function TransportBar({ layout }: { layout: PracticeLayout }) {
  const practice = usePractice()
  const { player, state, layers, grid, audioStatus, send } = practice
  const promptPass = usePracticeUi((s) => s.promptPass)
  const mixerOpen = usePracticeUi((s) => s.mixerOpen)
  const playing = PLAYING.has(state)
  const loopActive = player.loop !== null
  const compact = layout === 'phone-portrait' || layout === 'phone-landscape'
  const ready = audioStatus === 'ready' && state !== 'loading'

  const pass = (loopActive || !compact) && (
    <PassControl
      className={cn('ml-auto shrink-0', !loopActive && 'invisible')}
      inert={!loopActive}
      compact={compact}
      prompting={promptPass > 0}
      question={m['practice.pass_prompt']({
        pass: String(promptPass),
        speed: formatPercent(player.speedPct),
      })}
      labels={{
        prompt: m['practice.pass_rate'](),
        clean: m['practice.felt_clean'](),
        notYet: m['practice.not_yet'](),
      }}
      best={
        practice.best === null
          ? undefined
          : m['practice.best_tempo']({ pct: String(practice.best) })
      }
      shortcuts={{ clean: 'C', notYet: 'N' }}
      onClean={() => practice.markPass('clean')}
      onNotYet={() => practice.markPass('not_yet')}
    />
  )

  return (
    <div
      role="toolbar"
      aria-label={m['practice.transport']()}
      data-slot="transport-bar"
      className="flex shrink-0 items-center gap-3 border-t border-border bg-card px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:px-6"
    >
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-wrap items-center gap-3',
          layout === 'tablet-portrait' && 'justify-center',
        )}
      >
        <fieldset
          aria-label={m['practice.group_position']()}
          className="m-0 flex items-center gap-2 border-0 p-0"
        >
          <TransportButton
            icon={<SkipBackIcon aria-hidden />}
            label={loopActive ? m['practice.restart_loop']() : m['practice.previous_bar']()}
            showLabel={false}
            shortcut="←"
            disabled={!ready}
            onClick={() => practice.restart()}
          />
          <TransportButton
            tone="primary"
            className={cn(compact ? 'min-h-18 min-w-18' : '')}
            icon={playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
            label={playing ? m['practice.pause']() : m['practice.play']()}
            showLabel={false}
            shortcut={m['practice.key_space']()}
            disabled={!ready}
            onClick={() => practice.togglePlay()}
          />
        </fieldset>
        <fieldset
          aria-label={m['practice.group_loop']()}
          className="m-0 flex min-w-0 flex-1 items-center gap-1 border-0 p-0 sm:flex-none"
        >
          <TransportButton
            icon={<RepeatIcon aria-hidden />}
            label={m['practice.loop']()}
            showLabel={false}
            shortcut="L"
            {...(loopActive
              ? {
                  pressed: player.loopOn,
                  onPressedChange: (on: boolean) => send({ type: 'SET_LOOP_ON', on }),
                }
              : { onClick: () => usePracticeUi.setState({ loopHint: true }) })}
            disabled={!ready}
          />
          <LoopControl compact={compact} />
        </fieldset>
        <SpeedControl
          compact={compact}
          value={player.speedPct}
          onValueChange={(value) => practice.setSpeed(value)}
          bpm={grid?.bpm}
          labels={{
            speed: m['practice.speed'](),
            decrease: m['shortcuts.slower'](),
            increase: m['shortcuts.faster'](),
            presets: m['practice.speed_presets'](),
          }}
          shortcuts={{ decrease: ',', increase: '.' }}
        />
        {!compact && (
          <fieldset
            aria-label={m['practice.group_helpers']()}
            className="m-0 flex items-center gap-2 border-0 p-0"
          >
            <TransportButton
              icon={<CountInIcon aria-hidden />}
              label={m['practice.count_in']()}
              showLabel={false}
              pressed={player.countIn && layers.beats}
              disabled={!layers.beats}
              onPressedChange={(on) => send({ type: 'SET_COUNT_IN', on })}
            />
            <TransportButton
              size="practice-2"
              icon={<MetronomeIcon aria-hidden />}
              label={m['practice.metronome']()}
              showLabel={false}
              pressed={player.metronome && layers.beats}
              disabled={!layers.beats}
              onPressedChange={(on) => send({ type: 'SET_METRONOME', on })}
            />
            <TransportButton
              size="practice-2"
              icon={<SlidersVerticalIcon aria-hidden />}
              label={m['practice.mix']()}
              showLabel={false}
              pressed={mixerOpen && layers.stems}
              disabled={!layers.stems}
              onPressedChange={(open) => usePracticeUi.setState({ mixerOpen: open })}
            />
          </fieldset>
        )}
        {!compact && <VolumeControl />}
        {compact && pass}
      </div>
      {!compact && pass}
      <span className="sr-only" aria-live="polite">
        {promptPass > 0
          ? m['practice.pass_done']({
              pass: String(promptPass),
              speed: formatPercent(player.speedPct),
            })
          : ''}
      </span>
    </div>
  )
}

const volumeIcon = (volume: number) =>
  volume === 0 ? VolumeXIcon : volume < 50 ? Volume1Icon : Volume2Icon

// Master volume (per device): mute and a fader. A tap on the track or on mute works without
// dragging (WCAG 2.5.7); unmute returns to the level before muting.
export function VolumeFields() {
  const volume = usePracticeDefaults((s) => s.volumePct)
  const update = usePracticeDefaults((s) => s.update)
  const restore = useRef(volume > 0 ? volume : 100)
  const label = m['practice.volume']()
  const Icon = volumeIcon(volume)
  return (
    <>
      <TransportButton
        size="practice-2"
        icon={<Icon aria-hidden />}
        label={m['practice.mute']()}
        showLabel={false}
        pressed={volume === 0}
        onPressedChange={(muted) => {
          if (muted) restore.current = volume
          update({ volumePct: muted ? 0 : restore.current })
        }}
      />
      <div className="w-37.5 shrink-0">
        <Slider
          value={volume}
          step={1}
          largeStep={10}
          onValueChange={(next) =>
            update({ volumePct: Array.isArray(next) ? (next[0] ?? 0) : next })
          }
          thumbLabels={[label]}
        />
      </div>
    </>
  )
}

/** The volume: its fields in a group, or (a narrow dock, 26 §7) a popover behind its icon. */
export function VolumeControl({ popover = false }: { popover?: boolean }) {
  const volume = usePracticeDefaults((s) => s.volumePct)
  const label = m['practice.volume']()
  if (popover) {
    const Icon = volumeIcon(volume)
    return (
      <Popover>
        <PopoverTrigger
          aria-label={`${label}: ${formatPercent(volume)}`}
          className="inline-grid size-13 shrink-0 place-items-center rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-5"
        >
          <Icon aria-hidden strokeWidth={1.8} />
        </PopoverTrigger>
        <Suspense fallback={null}>
          <VolumePanel />
        </Suspense>
      </Popover>
    )
  }
  return (
    <fieldset aria-label={label} className="m-0 flex items-center gap-1 border-0 p-0">
      <VolumeFields />
    </fieldset>
  )
}

// The loop pill opens the loop's options; on phones the joined toggle already shows the loop
// icon, so the pill is text only.
function LoopControl({ compact }: { compact: boolean }) {
  const pill = useLoopPill()
  return (
    <Popover>
      <PopoverTrigger
        render={
          <LoopBadge
            state={pill.state}
            detail={compact ? undefined : pill.detail}
            className={cn('min-w-0 flex-1', compact && 'px-3 [&>svg]:hidden')}
          >
            {pill.text}
          </LoopBadge>
        }
      />
      <Suspense fallback={null}>
        <LoopPanel />
      </Suspense>
    </Popover>
  )
}
