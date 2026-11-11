import {
  MetronomeIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SlidersVerticalIcon,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CountInIcon } from '@/ui/icons'
import { LoopBadge } from '@/ui/loop-badge'
import { SpeedControl } from '@/ui/speed-control'
import { TransportButton } from '@/ui/transport-button'
import { presetOf } from './model/mixer'
import { usePractice } from './practice-context'
import { openTab, usePracticeUi } from './practice-store'
import { useLoopPill, VolumeControl } from './transport-bar'

// The transport dock (27 §3.7.1, 26 §7, §8, Main.dc.html; desktop): 96 px on --card holding the
// main practice controls at 64 × 64 (V11) — Restart ("Restart loop" while looping, else "Back a
// bar"), Play/Pause (amber), Next bar — the position (mono 22 "26.3" / 92 over "1:04 / 3:50"; a tap
// switches bar.beat ↔ time), the loop pill (opens Loop), speed − / "75 %" "72 BPM · → 100" (the
// ladder's goal while it is on) / +, then
// Count-in (64), Click (52), the mix pill (52; "Your part loud" / "2 stems · click on", opens Mix;
// "Mix" / "after your part is isolated" before the stems) and the volume (a slider; below 1440 px
// the mix pill keeps its icon and the volume moves into a popover, so nothing wraps). Nothing here
// moves when artefacts arrive.

const PLAYING = new Set(['countIn', 'playing', 'loopRest', 'assess', 'audition'])

const time = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// The position, written straight into the readout once per frame when its text changes (no
// re-render, no layout read).
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
      // The other reading underneath: the time under bar.beat, bar.beat under the time once the
      // beat is known.
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
      className="flex min-h-target-practice-2 w-29 shrink-0 flex-col items-start justify-center rounded-lg px-1 text-left hover:bg-muted max-lg:hidden"
    >
      <span className="font-mono text-read-readout leading-tight font-semibold tabular-nums">
        <span ref={main} />
        <span ref={total} className="text-sm text-faint-foreground" />
      </span>
      <span ref={sub} className="font-mono text-sm text-faint-foreground tabular-nums" />
      <span id={hintId} className="sr-only">
        {m['practice.position']()}
      </span>
    </button>
  )
}

function MixPill({ iconOnly }: { iconOnly: boolean }) {
  const { channels, mix, layers, player } = usePractice()
  const preset = presetOf(channels, mix)
  const name =
    preset === 'part-loud'
      ? m['mixer.preset_part_loud']()
      : preset === 'minus-one'
        ? m['mixer.preset_minus_one']()
        : preset === 'original'
          ? m['mixer.preset_original']()
          : m['practice.mix']()
  const detail = layers.stems
    ? [
        m['practice.mix_stems']({ count: String(channels.length) }),
        player.metronome && layers.beats ? m['practice.mix_click_on']() : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : m['practice.mix_after_stems']()
  return (
    <button
      type="button"
      data-slot="mix-pill"
      disabled={!layers.stems}
      aria-label={iconOnly ? `${layers.stems ? name : m['practice.mix']()}, ${detail}` : undefined}
      onClick={() => openTab('mix')}
      className={cn(
        'inline-flex min-h-13 shrink-0 items-center gap-2.5 rounded-2xl bg-muted px-3.5 text-left text-md font-semibold whitespace-nowrap inset-ring inset-ring-border-strong hover:bg-accent disabled:pointer-events-none disabled:text-faint-foreground disabled:inset-ring-input [&_svg]:size-5 [&_svg]:shrink-0',
        iconOnly && 'min-w-13 justify-center px-0',
      )}
    >
      <SlidersVerticalIcon aria-hidden strokeWidth={1.8} />
      {!iconOnly && (
        <span className="flex flex-col leading-tight">
          <span>{layers.stems ? name : m['practice.mix']()}</span>
          <span className="text-sm font-medium text-faint-foreground">{detail}</span>
        </span>
      )}
    </button>
  )
}

export function TransportDock({ roomy }: { roomy: boolean }) {
  const practice = usePractice()
  const { player, state, layers, grid, audioStatus, send, ladder } = practice
  const promptPass = usePracticeUi((s) => s.promptPass)
  const playing = PLAYING.has(state)
  const loopActive = player.loop !== null
  const ready = audioStatus === 'ready' && state !== 'loading'
  const pill = useLoopPill()
  return (
    <div
      role="toolbar"
      aria-label={m['practice.transport']()}
      data-slot="transport-dock"
      className="flex h-24 shrink-0 items-center gap-3 border-t border-border bg-card px-5 xl:gap-4.5"
    >
      <div className="flex items-center gap-2">
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
          icon={playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
          label={playing ? m['practice.pause']() : m['practice.play']()}
          showLabel={false}
          shortcut={m['practice.key_space']()}
          disabled={!ready}
          onClick={() => practice.togglePlay()}
        />
        <TransportButton
          icon={<SkipForwardIcon aria-hidden />}
          label={m['shortcuts.next']()}
          showLabel={false}
          shortcut="→"
          disabled={!ready}
          onClick={() => practice.stepBar(1)}
        />
      </div>
      <Position />
      <span aria-hidden className="h-13 w-px shrink-0 bg-border" />
      <LoopBadge
        state={pill.state}
        detail={pill.detail}
        onClick={() => openTab('loop')}
        className="max-w-72 min-w-44 shrink"
      >
        {pill.text}
      </LoopBadge>
      <SpeedControl
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
        shortcuts={{ decrease: ',', increase: '.' }}
      />
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
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
        <MixPill iconOnly={!roomy} />
        <VolumeControl popover={!roomy} />
      </div>
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
