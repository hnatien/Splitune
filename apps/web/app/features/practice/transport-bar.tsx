import {
  MetronomeIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SkipBackIcon,
  SlidersVerticalIcon,
} from 'lucide-react'
import { lazy, Suspense } from 'react'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CountInIcon } from '@/ui/icons'
import { LoopBadge, type LoopState } from '@/ui/loop-badge'
import { PassControl } from '@/ui/pass-control'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { SpeedControl } from '@/ui/speed-control'
import { TransportButton } from '@/ui/transport-button'
import type { PracticeLayout } from './layout'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The loop's options load on first open (12 §10 route budget).
const LoopPanel = lazy(() =>
  import('./loop-panel').then((module) => ({ default: module.LoopPanel })),
)

// TransportBar (12 §2, 27 §3.7.1): at the bottom edge on every layout (closest to the hands at a
// stand), safe-area aware: restart and a large round play; the loop (its on/off toggle joined to
// the "Loop · bars 17–20 · pass 3" badge, which opens the loop's options); speed −/+ around
// "70 % · 84 BPM"; count-in, metronome and the mixer; and at the right edge "How was pass 3?" with
// "Felt clean / Not yet". The controls wrap among themselves when the bar is narrow, the pass pair
// keeps its edge (on phones it wraps with them, beside speed). Count-in and metronome wait for the
// beat grid. Mix and the pass pair keep their place before stems and a loop exist, so nothing
// moves when they arrive.

const PLAYING = new Set(['countIn', 'playing', 'loopRest', 'assess', 'audition'])

// The two icons of play and pause sit on top of each other and cross-fade.
const FADE = 'col-start-1 row-start-1 size-9 transition-[opacity,scale] duration-(--duration-fast)'
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
  // Phones take the secondary size for everything but play, so the bar fits two rows.
  const secondary = compact ? 'practice-2' : 'practice'

  const pass = (loopActive || !compact) && (
    <PassControl
      className={cn('ml-auto shrink-0', !loopActive && 'invisible')}
      inert={!loopActive}
      compact={compact}
      prompting={promptPass > 0}
      question={m['practice.pass_question']({ pass: String(promptPass) })}
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
  )

  return (
    <div
      role="toolbar"
      aria-label={m['practice.transport']()}
      data-slot="transport-bar"
      className="flex shrink-0 items-center gap-3 border-t border-border bg-background px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:px-6"
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
            size={secondary}
            shortcut="←"
            disabled={!ready}
            onClick={() => practice.restart()}
          />
          <TransportButton
            tone="primary"
            className={cn('rounded-full', compact ? 'min-h-16 min-w-16' : 'min-h-18 min-w-18')}
            icon={
              <span className="grid place-items-center">
                <PauseIcon aria-hidden className={cn(FADE, playing ? SHOWN : HIDDEN)} />
                <PlayIcon aria-hidden className={cn(FADE, playing ? HIDDEN : SHOWN)} />
              </span>
            }
            label={playing ? m['practice.pause']() : m['practice.play']()}
            showLabel={false}
            shortcut={m['practice.key_space']()}
            disabled={!ready}
            onClick={() => practice.togglePlay()}
          />
        </fieldset>
        <fieldset
          aria-label={m['practice.group_loop']()}
          className="m-0 flex min-w-0 flex-1 items-center gap-1 rounded-2xl border-0 bg-surface-sunken p-1 sm:flex-none"
        >
          {loopActive ? (
            <TransportButton
              icon={<RepeatIcon aria-hidden />}
              label={m['practice.loop']()}
              showLabel={false}
              size={secondary}
              shortcut="L"
              pressed={player.loopOn}
              disabled={!ready}
              onPressedChange={(on) => send({ type: 'SET_LOOP_ON', on })}
            />
          ) : (
            <TransportButton
              icon={<RepeatIcon aria-hidden />}
              label={m['practice.loop']()}
              showLabel={false}
              size={secondary}
              shortcut="L"
              disabled={!ready}
              onClick={() => usePracticeUi.setState({ loopHint: true })}
            />
          )}
          <LoopControl compact={compact} />
        </fieldset>
        <SpeedControl
          compact={compact}
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
          <fieldset
            aria-label={m['practice.group_helpers']()}
            className="m-0 flex items-center gap-2 border-0 p-0"
          >
            <TransportButton
              size="practice-2"
              icon={<CountInIcon aria-hidden />}
              label={m['practice.count_in']()}
              showLabel="wide"
              pressed={player.countIn && layers.beats}
              disabled={!layers.beats}
              onPressedChange={(on) => send({ type: 'SET_COUNT_IN', on })}
            />
            <TransportButton
              size="practice-2"
              icon={<MetronomeIcon aria-hidden />}
              label={m['practice.metronome']()}
              showLabel="wide"
              pressed={player.metronome && layers.beats}
              disabled={!layers.beats}
              onPressedChange={(on) => send({ type: 'SET_METRONOME', on })}
            />
            <TransportButton
              size="practice-2"
              icon={<SlidersVerticalIcon aria-hidden />}
              label={m['practice.mix']()}
              showLabel="wide"
              pressed={mixerOpen && layers.stems}
              disabled={!layers.stems}
              onPressedChange={(open) => usePracticeUi.setState({ mixerOpen: open })}
            />
          </fieldset>
        )}
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

// The loop badge ("Loop · bars 17–20 · pass 3") names the loop for distance reading and opens
// the loop's options. On phones the joined toggle already shows the loop icon, so the badge is
// text only.
function LoopControl({ compact }: { compact: boolean }) {
  const { player, state } = usePractice()
  const selection = usePracticeUi((s) => s.selection)
  const loop = player.loop
  const badge: LoopState =
    selection.kind === 'armed'
      ? 'armed'
      : !loop || !player.loopOn
        ? 'off'
        : state === 'loopRest' || state === 'assess'
          ? 'resting'
          : 'active'
  const bars = loop ? `${loop.startBar + 1}–${loop.endBar + 1}` : ''
  const text = loop
    ? player.pass > 0
      ? m['practice.loop_badge_pass']({ bars, pass: String(player.pass) })
      : m['practice.loop_badge']({ bars })
    : selection.kind === 'armed'
      ? m['practice.loop_armed']({ bar: String(selection.bar + 1) })
      : m['practice.loop_off']()
  return (
    <Popover>
      <PopoverTrigger
        render={
          <LoopBadge
            state={badge}
            className={cn(
              'min-w-0 flex-1 rounded-xl',
              compact
                ? 'min-h-target-practice-2 px-3 text-sm [&>svg]:hidden'
                : 'min-h-target-practice text-read-label',
            )}
          >
            {text}
          </LoopBadge>
        }
      />
      <Suspense fallback={null}>
        <LoopPanel />
      </Suspense>
    </Popover>
  )
}
