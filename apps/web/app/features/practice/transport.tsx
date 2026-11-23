import { Link } from '@tanstack/react-router'
import {
  MetronomeIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  RotateCcwIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SlidersVerticalIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CountInIcon } from '@/ui/icons'
import { LoopBadge, type LoopState } from '@/ui/loop-badge'
import { PassControl } from '@/ui/pass-control'
import { PedalHud } from '@/ui/pedal-hud'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { Slider } from '@/ui/slider'
import { SpeedControl } from '@/ui/speed-control'
import { TransportButton } from '@/ui/transport-button'
import { pedalMoment } from './input-mapper'
import { isPhone, type PracticeLayout, useTransportStacked } from './layout'
import { presetName } from './mix-copy'
import { presetOf } from './model/mixer'
import { usePractice } from './practice-context'
import { openTab, usePracticeUi } from './practice-store'

// The volume's fields load on first open (12 §10 route budget).
const VolumePanel = lazy(() =>
  import('./volume-panel').then((module) => ({ default: module.VolumePanel })),
)

// The transport (27 §3.7.1–§3.7.2, 26 §7–§8): one bar for every layout, at the bottom edge, that
// nothing arriving ever moves.
//
// Wide (fine pointers, tablets): one 80 px row. Left: From the top, Previous bar, Play (the one
// filled control on the screen, 64 px), Next bar and the position. Centre: the loop toggle and
// the loop line, which opens the Loop tab; after a looped pass the pass prompt takes this place,
// so it never covers the music. Right: Count-in, Click, speed − / "70 %" / +, Tools and the volume.
//
// Phones and screens under 1024 px: a status row (the loop line or the pass prompt) over two rows,
// loop · count-in · speed and Tools · previous · Play · next · from the top (with the click and the
// volume where there is room). Every control keeps its own 48 px target and
// nothing wraps or overflows at 375 px.

const PLAYING = new Set(['countIn', 'playing', 'loopRest', 'assess', 'audition'])

const time = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The loop line's state and words (27 §3.7.1): "Loop · bars 25–28" / "pass 2 · rest 1 beat"; off
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

// The position, written straight into the readout once per frame when its text changes (no
// re-render, no layout read). A press switches bar.beat and time.
function Position() {
  const { audio, grid, data } = usePractice()
  const [asTime, setAsTime] = useState(false)
  const hintId = useId()
  const main = useRef<HTMLSpanElement>(null)
  const sub = useRef<HTMLSpanElement>(null)
  const total = useRef<HTMLSpanElement>(null)
  const duration = audio.duration || data.song.data?.duration_s || 0
  useEffect(() => {
    let frame = 0
    let last = ''
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const seconds = audio.position()
      const at = grid && !asTime ? grid.positionAt(seconds) : undefined
      const bars = grid?.positionAt(seconds)
      const barBeat = bars ? `${bars.bar < 0 ? 0 : bars.bar + 1}.${bars.beat}` : undefined
      const big = at ? `${at.bar < 0 ? 0 : at.bar + 1}.${at.beat}` : time(seconds)
      const small = at ? `${time(seconds)} / ${time(duration)}` : (barBeat ?? '')
      const key = `${big}|${small}`
      if (key === last) return
      last = key
      if (main.current) main.current.textContent = big
      if (sub.current) sub.current.textContent = small
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [audio, grid, asTime, duration])
  useEffect(() => {
    if (total.current) {
      total.current.textContent =
        grid && !asTime ? ` / ${grid.lastBar + 1}` : ` / ${time(duration)}`
    }
  }, [grid, asTime, duration])
  return (
    <button
      type="button"
      aria-describedby={hintId}
      aria-pressed={asTime}
      data-slot="position"
      onClick={() => setAsTime(!asTime)}
      className="flex min-h-target-practice w-28 shrink-0 flex-col items-start justify-center rounded-field px-2 text-left hover:bg-hover"
    >
      <span className="text-title tabular-nums">
        <span ref={main} />
        <span ref={total} className="text-body-sm text-faint-foreground" />
      </span>
      <span ref={sub} className="text-caption text-muted-foreground tabular-nums" />
      <span id={hintId} className="sr-only">
        {m['practice.position']()}
      </span>
    </button>
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
        size="practice"
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

/** The master volume behind its icon: the transport keeps one row at every width. */
function VolumeControl() {
  const volume = usePracticeDefaults((s) => s.volumePct)
  const Icon = volumeIcon(volume)
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${m['practice.volume']()}: ${formatPercent(volume)}`}
        className="inline-grid size-target-practice shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-hover hover:text-foreground [&_svg]:size-5"
      >
        <Icon aria-hidden strokeWidth={1.8} />
      </PopoverTrigger>
      <Suspense fallback={null}>
        <VolumePanel />
      </Suspense>
    </Popover>
  )
}

/** Tools (27 §3.7.1): opens the panel on Mix and names the mix in play, so the transport shows
 * what is heard without a second readout. X does the same. */
function ToolsButton({ compact }: { compact: boolean }) {
  const { channels, mix, layers } = usePractice()
  const open = usePracticeUi((s) => s.inspectorOpen)
  const preset = layers.stems ? presetOf(channels, mix) : null
  const name = preset ? presetName(preset) : m['practice.tools']()
  return (
    <TransportButton
      size="practice"
      icon={<SlidersVerticalIcon aria-hidden />}
      label={compact ? m['practice.tools']() : name}
      showLabel={!compact}
      shortcut="X"
      pressed={open}
      onPressedChange={(next) =>
        next
          ? openTab(usePracticeUi.getState().tab)
          : usePracticeUi.setState({ inspectorOpen: false })
      }
    />
  )
}

function usePass() {
  const practice = usePractice()
  const promptPass = usePracticeUi((s) => s.promptPass)
  const loopActive = practice.player.loop !== null
  return {
    asking: loopActive && promptPass > 0,
    loopActive,
    promptPass,
    props: {
      prompting: promptPass > 0,
      question: m['practice.pass_prompt']({
        pass: String(promptPass),
        speed: formatPercent(practice.player.speedPct),
      }),
      labels: {
        prompt: m['practice.pass_rate'](),
        clean: m['practice.felt_clean'](),
        notYet: m['practice.not_yet'](),
      },
      best:
        practice.best === null
          ? undefined
          : m['practice.best_tempo']({ pct: String(practice.best) }),
      shortcuts: { clean: 'C', notYet: 'N' },
      onClean: () => practice.markPass('clean'),
      onNotYet: () => practice.markPass('not_yet'),
    },
  }
}

/**
 * What the pedal's two sides do at this moment (27 §3.7.6), once a pedal has been pressed here:
 * "◀ Restart loop · Play ▶", after a looped pass "◀ Not yet · Felt clean ▶", in Fix the previous
 * and next unsure spot. Left is always "again" and right "go"; the words say which.
 */
function PedalLegend({ className }: { className?: string }) {
  const { player, state } = usePractice()
  const seen = usePracticeUi((s) => s.pedalSeen)
  const promptPass = usePracticeUi((s) => s.promptPass)
  const fixing = usePracticeUi((s) => s.fixing)
  if (!seen) return null
  const moment = pedalMoment({ promptPass, loop: player.loop !== null, fixing })
  const [left, right] =
    moment === 'pass'
      ? [m['practice.not_yet'](), m['practice.felt_clean']()]
      : moment === 'fix'
        ? [m['shortcuts.previous_unsure'](), m['shortcuts.next_unsure']()]
        : [
            player.loop && player.loopOn
              ? m['practice.restart_loop']()
              : m['practice.previous_bar'](),
            PLAYING.has(state) ? m['practice.pause']() : m['practice.play'](),
          ]
  return (
    <p
      data-slot="pedal-legend"
      data-moment={moment}
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-caption whitespace-nowrap text-muted-foreground',
        className,
      )}
    >
      <span className="sr-only">{m['practice.pedal_now']()}: </span>
      <span>
        <span aria-hidden>◀ </span>
        <span className="sr-only">{m['practice.pedal_left']()}, </span>
        {left}
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="sr-only">{m['practice.pedal_right']()}, </span>
        {right}
        <span aria-hidden> ▶</span>
      </span>
    </p>
  )
}

/** The loop toggle (L). With no loop yet it shows how to make one. */
function LoopToggle({ ready }: { ready: boolean }) {
  const { player, send } = usePractice()
  const loopActive = player.loop !== null
  return (
    <TransportButton
      size="practice"
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
  )
}

/** The loop toggle joined to the loop line, which opens the Loop tab. */
function LoopControl({ ready }: { ready: boolean }) {
  const pill = useLoopPill()
  return (
    <fieldset
      aria-label={m['practice.group_loop']()}
      className="m-0 flex min-w-0 items-center gap-1 border-0 p-0"
    >
      <LoopToggle ready={ready} />
      <LoopBadge
        state={pill.state}
        detail={pill.detail}
        onClick={() => openTab('loop')}
        className="max-w-72 min-w-0 shrink"
      >
        {pill.text}
      </LoopBadge>
    </fieldset>
  )
}

// The key and pedal confirmation (26 §13), beside the music on every layout and never over it:
// on the wide transport it sits on the key row just above the bar, on a phone at the end of the
// status row. It shows for 1.2 s and ignores the pointer, so what is under it still takes a press.
function Hud({ className }: { className?: string }) {
  const hud = usePracticeUi((s) => s.hud)
  return (
    <PedalHud
      message={hud.message}
      sequence={hud.sequence}
      source={hud.source}
      className={cn('absolute z-(--z-hud) max-w-[calc(100%-1.5rem)]', className)}
      action={
        hud.setUp
          ? (content, chip) => (
              <Link to="/settings/keyboard" tabIndex={-1} className={chip}>
                {content}
              </Link>
            )
          : undefined
      }
    />
  )
}

export function Transport({ layout }: { layout: PracticeLayout }) {
  const practice = usePractice()
  const { player, state, layers, grid, audioStatus, send, ladder } = practice
  const playing = PLAYING.has(state)
  const loopActive = player.loop !== null
  const ready = audioStatus === 'ready' && state !== 'loading'
  const phone = isPhone(layout)
  const compact = useTransportStacked(layout)
  const pass = usePass()
  const loopLine = useLoopPill()
  const speedOpen = usePracticeUi((s) => s.speedOpen)

  const restart = (
    <TransportButton
      size="practice"
      icon={<RotateCcwIcon aria-hidden />}
      label={loopActive ? m['practice.restart_loop']() : m['practice.from_the_top']()}
      showLabel={false}
      shortcut="R"
      disabled={!ready}
      onClick={() => practice.restart()}
    />
  )
  const previous = (
    <TransportButton
      size="practice"
      icon={<SkipBackIcon aria-hidden />}
      label={m['practice.previous_bar']()}
      showLabel={false}
      shortcut="←"
      disabled={!ready}
      onClick={() => practice.stepBar(-1)}
    />
  )
  const play = (
    <TransportButton
      tone="primary"
      icon={playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
      label={playing ? m['practice.pause']() : m['practice.play']()}
      showLabel={false}
      shortcut={m['practice.key_space']()}
      disabled={!ready}
      onClick={() => practice.togglePlay()}
    />
  )
  const next = (
    <TransportButton
      size="practice"
      icon={<SkipForwardIcon aria-hidden />}
      label={m['shortcuts.next']()}
      showLabel={false}
      shortcut="→"
      disabled={!ready}
      onClick={() => practice.stepBar(1)}
    />
  )
  const countIn = (
    <TransportButton
      size="practice"
      icon={<CountInIcon aria-hidden />}
      label={m['practice.count_in']()}
      showLabel={false}
      shortcut="I"
      pressed={player.countIn && layers.beats}
      disabled={!layers.beats}
      onPressedChange={(on) => send({ type: 'SET_COUNT_IN', on })}
    />
  )
  const click = (
    <TransportButton
      size="practice"
      icon={<MetronomeIcon aria-hidden />}
      label={m['practice.metronome']()}
      showLabel={false}
      pressed={player.metronome && layers.beats}
      disabled={!layers.beats}
      onPressedChange={(on) => send({ type: 'SET_METRONOME', on })}
    />
  )
  const speed = (
    <SpeedControl
      compact={phone}
      value={player.speedPct}
      onValueChange={(value) => practice.setSpeed(value)}
      bpm={grid?.bpm}
      goal={
        ladder
          ? {
              text: m['ladder.goal_readout']({ goal: String(ladder.rungs.at(-1)) }),
              label: m['ladder.goal_label']({ speed: formatPercent(ladder.rungs.at(-1) ?? 100) }),
            }
          : undefined
      }
      inlinePresets={false}
      labels={{
        speed: m['practice.speed'](),
        decrease: m['shortcuts.slower'](),
        increase: m['shortcuts.faster'](),
        presets: m['practice.speed_presets'](),
      }}
      shortcuts={{ decrease: ',', increase: '.', open: 'S' }}
      open={speedOpen}
      onOpenChange={(open) => usePracticeUi.setState({ speedOpen: open })}
    />
  )
  const announce = (
    <span className="sr-only" aria-live="polite">
      {pass.promptPass > 0
        ? m['practice.pass_done']({
            pass: String(pass.promptPass),
            speed: formatPercent(player.speedPct),
          })
        : ''}
    </span>
  )

  if (compact) {
    return (
      <div
        role="toolbar"
        aria-label={m['practice.transport']()}
        data-slot="transport"
        data-layout="compact"
        // Two rows leave no room for key caps; the keys still work and are named to AT. A phone
        // keeps the click in the Mix tab and uses the device's volume; wider screens have room.
        className="flex shrink-0 flex-col border-t border-border bg-background pb-[env(safe-area-inset-bottom)] [&_[data-slot=kbd]]:hidden"
      >
        <div data-slot="transport-status" className="border-b border-border px-3">
          <div className="relative mx-auto flex min-h-14 w-full max-w-xl items-center gap-2">
            <Hud className="top-1/2 right-0 -translate-y-1/2" />
            {pass.asking ? (
              <PassControl {...pass.props} compact className="w-full justify-between" />
            ) : (
              <button
                type="button"
                data-slot="loop-line"
                onClick={() => openTab('loop')}
                className="flex min-h-target min-w-0 flex-1 items-center rounded-field px-1 text-left text-label-sm text-muted-foreground hover:bg-hover"
              >
                <span className="truncate">
                  <span className="text-foreground">{loopLine.text}</span>
                  {loopLine.detail && ` · ${loopLine.detail}`}
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-1 px-2 pt-2">
          <LoopToggle ready={ready} />
          {countIn}
          {speed}
        </div>
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-1 px-2 py-2">
          <ToolsButton compact />
          {!phone && click}
          {previous}
          {play}
          {next}
          {restart}
          {!phone && <VolumeControl />}
        </div>
        {announce}
      </div>
    )
  }

  return (
    <div
      role="toolbar"
      aria-label={m['practice.transport']()}
      data-slot="transport"
      data-layout="wide"
      // Key caps need the room a docked panel needs: they show from 1180 px.
      className="relative flex h-20 shrink-0 items-center gap-2 border-t border-border bg-background px-4 pb-[env(safe-area-inset-bottom)] max-[1180px]:[&_[data-slot=kbd]]:hidden"
    >
      <Hud className="bottom-full left-1/2 mb-0.5 -translate-x-1/2" />
      <fieldset
        aria-label={m['practice.group_position']()}
        className="m-0 flex shrink-0 items-center gap-1 border-0 p-0"
      >
        {restart}
        {previous}
        {play}
        {next}
      </fieldset>
      <div className="max-xl:hidden">
        <Position />
      </div>
      <PedalLegend className="max-2xl:hidden" />
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {pass.asking ? <PassControl {...pass.props} /> : <LoopControl ready={ready} />}
      </div>
      <fieldset
        aria-label={m['practice.group_helpers']()}
        className="m-0 flex shrink-0 items-center gap-1 border-0 p-0"
      >
        {countIn}
        {click}
      </fieldset>
      {speed}
      <ToolsButton compact={false} />
      <VolumeControl />
      {announce}
    </div>
  )
}
