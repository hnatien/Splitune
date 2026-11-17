import { MinusIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, Undo2Icon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Kbd } from '@/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { TransportButton } from '@/ui/transport-button'
import { barLabel, barsLabel } from './fix-cards'
import { useFix } from './fix-store'
import { FixSynth } from './fix-synth'
import { useCorrections } from './model/corrections'
import { FIX_LISTEN, type FixListen, listensToSynth } from './model/fix-listen'
import { buildQueue, type Spot, spotFor, stepSpot } from './model/fix-queue'
import { wrongOneIn } from './model/frequency'
import { ignoredTarget } from './model/keymap'
import { barRange, type LoopRange } from './model/loops'
import type { RestBetween } from './model/player-machine'
import { chordEvents, chordVoicing, noteEvents, type SynthEvent } from './model/synth-schedule'
import { usePractice } from './practice-context'
import { leaveFix, showHud, usePracticeUi } from './practice-store'

// Fix mode (12 §4, 27 §3.7.4, Practice-Fix.dc.html), loaded when it is entered: the queue of unsure
// spots and the selection J / K / E move through it; the player handed over to the selected bars
// (they loop at the Fix dock's own speed, with nothing asked between passes) and handed back as
// it was; the synth that plays an alternative, or the transcribed part, over that loop; the top
// bar's pill, the key line under the notation and the Fix dock.

/** The queue and where the selection sits in it. */
export function useFixQueue(): { queue: Spot[]; spot: Spot | undefined; position: number } {
  const { view, music, grid } = usePractice()
  const target = usePracticeUi((s) => s.editor)
  const queue = useMemo(
    () => (view && music && grid ? buildQueue(view, music, grid) : []),
    [view, music, grid],
  )
  const spot = target ? spotFor(queue, target) : undefined
  return { queue, spot, position: spot ? queue.indexOf(spot) + 1 : 0 }
}

export function selectSpot(spot: Spot) {
  usePracticeUi.setState({
    editor: {
      kind: 'bar',
      bar: spot.startBar,
      endBar: spot.endBar,
      chordId: spot.chordId,
      noteId: spot.noteId,
    },
  })
  useFix.setState({ audition: null, replaceable: null })
}

/** To the next (1) or previous (−1) unsure spot; says so when there is none. */
export function stepSelection(
  queue: readonly Spot[],
  current: Spot | undefined,
  direction: 1 | -1,
) {
  const next = stepSpot(queue, current?.id, direction)
  if (!next) {
    showHud(m['practice.hud_no_unsure']())
    return
  }
  selectSpot(next)
  showHud(m['practice.hud_bar']({ bar: barsLabel(next.startBar, next.endBar) }))
}

interface Before {
  loop: LoopRange | null
  loopOn: boolean
  speedPct: number
  rest: RestBetween
  restSeconds: number
  assessPrompt: boolean
  ladder: ReturnType<typeof usePractice>['player']['ladder']
}

/** The controller: mounted while Fix mode is on. `onLeave` is Done's and Esc's way out. */
export function FixMode({ onLeave = leaveFix }: { onLeave?: () => void }) {
  const practice = usePractice()
  const { grid, view, music, data, send, audio, player } = practice
  const { queue, spot } = useFixQueue()
  const target = usePracticeUi((s) => s.editor)
  const command = usePracticeUi((s) => s.fixCommand)
  const listen = usePracticeUi((s) => s.fixListen)
  const audition = useFix((s) => s.audition)
  const volumePct = usePracticeDefaults((s) => s.volumePct)
  const latest = useRef({ practice, queue, spot, onLeave, volumePct })
  latest.current = { practice, queue, spot, onLeave, volumePct }

  // The player is Fix mode's while it lasts: no ladder, rest or pass prompt between passes, and
  // the Fix dock's own speed. Leaving puts the learner's loop, speed and ladder back. It waits
  // for the saved loop and speed to be restored, so what it hands back is the learner's.
  const resumed = practice.resumed
  useEffect(() => {
    if (!resumed) return
    const { player: now, send: tell } = latest.current.practice
    const before: Before = {
      loop: now.loop,
      loopOn: now.loopOn,
      speedPct: now.speedPct,
      rest: now.rest,
      restSeconds: now.restSeconds,
      assessPrompt: now.assessPrompt,
      ladder: now.ladder,
    }
    tell({ type: 'SET_LADDER', ladder: null })
    tell({ type: 'SET_REST', rest: 'none', restSeconds: 0 })
    tell({ type: 'SET_ASSESS', on: false })
    const fixSpeed = useFix.getState().speedPct
    if (fixSpeed !== null && fixSpeed !== now.speedPct) tell({ type: 'SET_SPEED', pct: fixSpeed })
    usePracticeUi.setState({ promptPass: 0 })
    return () => {
      const { player: then, send: restore } = latest.current.practice
      useFix.setState({ speedPct: then.speedPct, audition: null, replaceable: null })
      restore({ type: 'PAUSE' })
      restore({ type: 'SET_LOOP', loop: before.loop })
      if (!before.loopOn) restore({ type: 'SET_LOOP_ON', on: false })
      restore({ type: 'SET_REST', rest: before.rest, restSeconds: before.restSeconds })
      restore({ type: 'SET_ASSESS', on: before.assessPrompt })
      if (then.speedPct !== before.speedPct) restore({ type: 'SET_SPEED', pct: before.speedPct })
      restore({ type: 'SET_LADDER', ladder: before.ladder })
    }
  }, [resumed])

  // J / K / E (12 §8): the last one pressed, taken once the queue exists.
  const taken = useRef(0)
  const ready = grid !== undefined && view !== undefined
  useEffect(() => {
    if (!command || command.sequence === taken.current || !ready) return
    taken.current = command.sequence
    const { queue: spots, spot: current } = latest.current
    if (command.kind === 'bar') {
      // Before the first downbeat the playhead is in no bar yet: E takes the first one.
      const { grid: bars } = latest.current.practice
      const bar = bars ? Math.min(bars.lastBar, Math.max(bars.firstBar, command.bar)) : command.bar
      const at = spotFor(spots, { bar })
      if (at) selectSpot(at)
      else usePracticeUi.setState({ editor: { kind: 'bar', bar } })
      showHud(m['practice.hud_bar']({ bar: barLabel(bar) }))
    } else {
      stepSelection(spots, current, command.kind === 'next' ? 1 : -1)
    }
    // Keys only (27 §2): the spot's first action takes focus (in the Fix tab, once its cards are
    // drawn), so Enter hears or confirms it.
    useFix.setState({ focus: true })
  }, [command, ready])

  // Entered by the tab with nothing chosen: the first spot of the queue.
  const first = queue[0]
  useEffect(() => {
    if (target || !first) return
    const pending = usePracticeUi.getState().fixCommand
    if (pending && pending.sequence !== taken.current) return
    selectSpot(first)
  }, [target, first])

  // The selected bars loop; a selection elsewhere starts from its first bar.
  const bar = target?.bar
  const endBar = target?.endBar ?? bar
  useEffect(() => {
    if (!resumed || !grid || bar === undefined || endBar === undefined) return
    const range = barRange(grid, bar, endBar)
    send({ type: 'SET_LOOP', loop: range })
    const at = audio.position()
    if (at < range.start || at >= range.end - 0.01) send({ type: 'SEEK', seconds: range.start })
  }, [resumed, grid, bar, endBar, send, audio])

  // The synth (12 §6 "Audition"): the alternative being heard and, for "Tab synth" and "Both",
  // the transcribed part, scheduled from the engine's clock over the loop.
  const [synth] = useState(
    () =>
      new FixSynth({
        context: () => latest.current.practice.audio.engine?.context ?? null,
        read: () => {
          const { audio: engine, player: now } = latest.current.practice
          return {
            position: engine.position(),
            rate: now.speedPct / 100,
            playing: engine.playing(),
            loop: now.loop && now.loopOn ? { start: now.loop.start, end: now.loop.end } : null,
          }
        },
        volume: () => (latest.current.volumePct / 100) ** 2,
      }),
  )
  useEffect(() => () => synth.stop(), [synth])
  const loop = player.loop
  const guitar = data.instrument === 'guitar'
  const capo = music?.tab?.capo ?? 0
  const events = useMemo(() => {
    if (!grid || !view || !loop) return []
    const out: SynthEvent[] = []
    if (listensToSynth(listen)) {
      out.push(...noteEvents(view.notes.filter((n) => n.onset >= loop.start && n.onset < loop.end)))
    }
    const chord = audition ? view.chords.find((c) => c.id === audition.chordId) : undefined
    if (audition && chord) {
      const beats = grid.bars
        .filter((b) => b >= loop.startBar && b <= loop.endBar)
        .flatMap((b) => grid.beatsOf(b))
      out.push(
        ...chordEvents(chordVoicing(audition.label, { guitar, capo }), beats, {
          start: Math.max(chord.t0, loop.start),
          end: Math.min(chord.t1, loop.end),
        }),
      )
    }
    return out
  }, [grid, view, loop, listen, audition, guitar, capo])
  useEffect(() => synth.setEvents(events), [synth, events])

  // Esc leaves Fix mode, unless a field or a popup has the key.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || ignoredTarget(event)) return
      latest.current.onLeave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}

// The top bar's centre in Fix mode: "Fixing · every change saves as you go", Undo and Done.
export function FixPill({ onDone = leaveFix }: { onDone?: () => void }) {
  const { undo } = usePractice()
  const undoCount = useCorrections((s) => s.undo.length)
  return (
    <div
      data-slot="fix-pill"
      className="flex h-11 items-center gap-2.5 rounded-xl bg-unsure-surface pr-1 pl-3.5 text-unsure"
    >
      <PencilIcon aria-hidden className="size-4.5 shrink-0" strokeWidth={1.8} />
      <span className="text-md font-[650] whitespace-nowrap max-lg:sr-only">
        {m['fix.fixing']()}
      </span>
      <Button
        size="icon-sm"
        aria-label={m['editor.undo']()}
        disabled={undoCount === 0}
        onClick={() => undo()}
      >
        <Undo2Icon aria-hidden />
      </Button>
      <Button size="sm" variant="primary" onClick={onDone}>
        {m['fix.done']()}
      </Button>
    </div>
  )
}

// The key line under the notation in Fix mode: what the marks mean, as samples, and the keys.
export function FixKey() {
  const { music, view } = usePractice()
  const sample =
    'inline-grid min-w-5 place-items-center rounded-xs px-0.5 font-reading-mono leading-5 font-semibold'
  // How often the song's unsure marks are wrong, from their own confidences.
  const n = useMemo(() => {
    if (!music || !view) return null
    const low = (ids: Set<string>, all: readonly { id: string; confidence: number }[]) =>
      all.filter((item) => ids.has(item.id)).map((item) => item.confidence)
    const chords = new Set(view.chords.filter((c) => c.confidence === 'low').map((c) => c.id))
    const notes = new Set(view.notes.filter((n) => n.confidence === 'low').map((n) => n.id))
    return wrongOneIn([...low(chords, music.displayChords), ...low(notes, music.tab?.notes ?? [])])
  }, [music, view])
  return (
    <div
      data-slot="fix-key"
      className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-5 gap-y-1 bg-paper px-12 py-1 text-sm text-muted-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={cn(sample, 'border-[1.5px] border-dashed border-conf-low text-conf-low')}
        >
          3
        </span>
        {m['fix.key_unsure']({ n: String(n ?? 3) })}
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={cn(sample, 'text-edited underline decoration-2 underline-offset-[3px]')}
        >
          7
        </span>
        {m['practice.edited']()}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Kbd>J</Kbd>
        <Kbd>K</Kbd>
        {m['fix.key_keys']()}
      </span>
    </div>
  )
}

const PLAYING = new Set(['countIn', 'playing', 'loopRest', 'assess', 'audition'])

const LISTEN_LABEL: Record<FixListen, () => string> = {
  original: () => m['fix.listen_original'](),
  part: () => m['fix.listen_part'](),
  synth: () => m['fix.listen_synth'](),
  both: () => m['fix.listen_both'](),
}

// The Fix dock (27 §3.7.4; 80 px): Play for the selected bars (64, V11), what it plays, Listen to
// (48 boxes) and the Fix speed − / + (64).
export function FixDock() {
  const practice = usePractice()
  const { player, state, audioStatus, layers } = practice
  const target = usePracticeUi((s) => s.editor)
  const listen = usePracticeUi((s) => s.fixListen)
  const playing = PLAYING.has(state)
  const ready = audioStatus === 'ready' && state !== 'loading' && target !== null
  const bar = target?.bar
  const endBar = target?.endBar ?? bar
  const many = bar !== undefined && endBar !== undefined && endBar > bar
  // "Your part" needs the isolated stem; the synth needs notes to play.
  const choices = FIX_LISTEN.filter(
    (choice) => (choice !== 'part' || layers.stems) && (!listensToSynth(choice) || layers.tab),
  )
  const speed = (delta: number) => practice.setSpeed(player.speedPct + delta)
  return (
    <div
      role="toolbar"
      aria-label={m['practice.transport']()}
      data-slot="fix-dock"
      className="flex h-20 shrink-0 items-center gap-3.5 border-t border-border bg-card px-5"
    >
      <TransportButton
        tone="primary"
        icon={playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
        label={
          playing || bar === undefined || endBar === undefined
            ? playing
              ? m['practice.pause']()
              : m['practice.play']()
            : many
              ? m['fix.play_bars']({ from: barLabel(bar), to: barLabel(endBar) })
              : m['fix.play_bar']({ bar: barLabel(bar) })
        }
        showLabel={false}
        shortcut={m['practice.key_space']()}
        disabled={!ready}
        onClick={() => practice.togglePlay()}
      />
      {bar !== undefined && endBar !== undefined && (
        <span className="text-base font-semibold whitespace-nowrap tabular-nums">
          {many
            ? m['fix.bars']({ bars: barsLabel(bar, endBar) })
            : m['fix.bar_one']({ bar: barLabel(bar) })}
        </span>
      )}
      <span className="min-w-0 truncate text-sm text-faint-foreground">{m['fix.dock_hint']()}</span>
      <div className="flex-1" />
      {choices.length > 1 && (
        <ToggleGroup
          aria-label={m['fix.listen']()}
          value={[choices.includes(listen) ? listen : 'original']}
          onValueChange={(next) => {
            const picked = next[0] as FixListen | undefined
            if (picked) usePracticeUi.setState({ fixListen: picked })
          }}
        >
          {choices.map((choice) => (
            <ToggleGroupItem key={choice} value={choice}>
              {LISTEN_LABEL[choice]()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <div className="flex items-center gap-1" data-slot="fix-speed">
        <Button
          variant="box"
          size="icon-practice"
          aria-label={m['shortcuts.slower']()}
          disabled={player.speedPct <= 50}
          onClick={() => speed(-5)}
        >
          <MinusIcon aria-hidden />
        </Button>
        <span
          aria-live="polite"
          className="w-16 text-center font-mono text-lg font-normal tabular-nums"
        >
          {formatPercent(player.speedPct)}
        </span>
        <Button
          variant="box"
          size="icon-practice"
          aria-label={m['shortcuts.faster']()}
          disabled={player.speedPct >= 100}
          onClick={() => speed(5)}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>
    </div>
  )
}
