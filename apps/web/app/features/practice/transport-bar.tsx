import {
  MetronomeIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SkipBackIcon,
  SlidersVerticalIcon,
} from 'lucide-react'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CountInIcon } from '@/ui/icons'
import { PassControl } from '@/ui/pass-control'
import { SpeedControl } from '@/ui/speed-control'
import { TransportButton } from '@/ui/transport-button'
import type { PracticeLayout } from './layout'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// TransportBar (12 §2, 27 §3.7.1): at the bottom edge on every layout (closest to the hands at a
// stand), safe-area aware. Three labelled groups on sunken trays: Position, Loop and speed,
// Practice helpers. Practice targets for restart/play/loop/speed and the pass pair; 48 px for
// count-in, metronome and the mixer. Count-in and metronome wait for the beat grid. Mix and the
// pass pair keep their place before stems and a loop exist, so nothing moves when they arrive.

const PLAYING = new Set(['countIn', 'playing', 'loopRest', 'assess', 'audition'])

const TRAY = 'm-0 flex min-w-0 items-center border-0 gap-1.5 rounded-2xl bg-surface-sunken p-1'
// The two icons of play and pause sit on top of each other and cross-fade.
const FADE = 'col-start-1 row-start-1 transition-[opacity,scale] duration-(--duration-fast)'
const SHOWN = 'opacity-100 scale-100'
const HIDDEN = 'opacity-0 scale-75'

export function TransportBar({ layout }: { layout: PracticeLayout }) {
  const practice = usePractice()
  const { player, state, layers, grid, audioStatus, send } = practice
  const promptPass = usePracticeUi((s) => s.promptPass)
  const mixerOpen = usePracticeUi((s) => s.mixerOpen)
  const playing = PLAYING.has(state)
  const loopActive = player.loop !== null
  const compact = layout === 'phone-portrait' || layout === 'phone-landscape'
  const ready = audioStatus === 'ready' && state !== 'loading'

  return (
    <div
      role="toolbar"
      aria-label={m['practice.transport']()}
      data-slot="transport-bar"
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-background px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]',
        layout === 'tablet-portrait' && 'justify-center',
      )}
    >
      <fieldset aria-label={m['practice.group_position']()} className={TRAY}>
        <TransportButton
          icon={<SkipBackIcon aria-hidden />}
          label={loopActive ? m['practice.restart_loop']() : m['practice.previous_bar']()}
          shortcut="←"
          disabled={!ready}
          onClick={() => practice.restart()}
        />
        <TransportButton
          tone="primary"
          icon={
            <span className="grid place-items-center">
              <PauseIcon aria-hidden className={cn(FADE, playing ? SHOWN : HIDDEN)} />
              <PlayIcon aria-hidden className={cn(FADE, playing ? HIDDEN : SHOWN)} />
            </span>
          }
          label={playing ? m['practice.pause']() : m['practice.play']()}
          shortcut={m['practice.key_space']()}
          disabled={!ready}
          onClick={() => practice.togglePlay()}
        />
      </fieldset>
      <fieldset aria-label={m['practice.group_loop_speed']()} className={TRAY}>
        {loopActive ? (
          <TransportButton
            icon={<RepeatIcon aria-hidden />}
            label={m['practice.loop']()}
            shortcut="L"
            pressed={player.loopOn}
            disabled={!ready}
            onPressedChange={(on) => send({ type: 'SET_LOOP_ON', on })}
          />
        ) : (
          <TransportButton
            icon={<RepeatIcon aria-hidden />}
            label={m['practice.loop']()}
            shortcut="L"
            disabled={!ready}
            onClick={() => usePracticeUi.setState({ loopHint: true })}
          />
        )}
        <SpeedControl
          value={player.speedPct}
          onValueChange={(value) => practice.setSpeed(value)}
          bpm={grid?.bpm}
          labels={{
            speed: m['practice.speed'](),
            decrease: m['practice.slower'](),
            increase: m['practice.faster'](),
            presets: m['practice.speed_presets'](),
          }}
          shortcuts={{ decrease: '↓', increase: '↑' }}
        />
      </fieldset>
      {!compact && (
        <fieldset aria-label={m['practice.group_helpers']()} className={TRAY}>
          <TransportButton
            size="practice-2"
            icon={<CountInIcon aria-hidden />}
            label={m['practice.count_in']()}
            pressed={player.countIn && layers.beats}
            disabled={!layers.beats}
            onPressedChange={(on) => send({ type: 'SET_COUNT_IN', on })}
          />
          <TransportButton
            size="practice-2"
            icon={<MetronomeIcon aria-hidden />}
            label={m['practice.metronome']()}
            pressed={player.metronome && layers.beats}
            disabled={!layers.beats}
            onPressedChange={(on) => send({ type: 'SET_METRONOME', on })}
          />
          <TransportButton
            size="practice-2"
            icon={<SlidersVerticalIcon aria-hidden />}
            label={m['practice.mix']()}
            pressed={mixerOpen && layers.stems}
            disabled={!layers.stems}
            onPressedChange={(open) => usePracticeUi.setState({ mixerOpen: open })}
          />
        </fieldset>
      )}
      {(loopActive || !compact) && (
        <PassControl
          className={cn('ml-auto', !loopActive && 'invisible')}
          inert={!loopActive}
          prompting={promptPass > 0}
          labels={{
            prompt: m['practice.pass_prompt'](),
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
      )}
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
