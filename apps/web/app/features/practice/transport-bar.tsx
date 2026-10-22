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
// stand), safe-area aware. Practice targets for restart/play/loop/speed and the pass pair; 48 px
// for count-in, metronome and the mixer. Count-in and metronome wait for the beat grid.

const PLAYING = new Set(['countIn', 'playing', 'loopRest', 'assess', 'audition'])

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
      <div className="flex items-center gap-3">
        <TransportButton
          icon={<SkipBackIcon aria-hidden />}
          label={loopActive ? m['practice.restart_loop']() : m['practice.previous_bar']()}
          shortcut="←"
          disabled={!ready}
          onClick={() => practice.restart()}
        />
        <TransportButton
          tone="primary"
          icon={playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
          label={playing ? m['practice.pause']() : m['practice.play']()}
          shortcut={m['practice.key_space']()}
          disabled={!ready}
          onClick={() => practice.togglePlay()}
        />
        <TransportButton
          icon={<RepeatIcon aria-hidden />}
          label={m['practice.loop']()}
          shortcut="L"
          pressed={loopActive && player.loopOn}
          disabled={!loopActive}
          onPressedChange={(on) => send({ type: 'SET_LOOP_ON', on })}
        />
      </div>
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
      {!compact && (
        <div className="flex items-center gap-2">
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
          {layers.stems && (
            <TransportButton
              size="practice-2"
              icon={<SlidersVerticalIcon aria-hidden />}
              label={m['practice.mix']()}
              pressed={mixerOpen}
              onPressedChange={(open) => usePracticeUi.setState({ mixerOpen: open })}
            />
          )}
        </div>
      )}
      {loopActive && (
        <PassControl
          className={cn(
            'ml-auto transition-opacity duration-(--duration-base)',
            promptPass > 0 ? 'opacity-100' : 'opacity-90',
          )}
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
