import {
  MinusIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { keyLabel } from './input-mapper'
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

// Fix mode (12 §4, 27 §3.7.4; s47 direction §7), loaded when it is entered: the queue of unsure
// spots and the selection J / K / E (and the pedal) move through it; the player handed over to the
// selected bars (they loop at the Fix dock's own speed, with nothing asked between passes) and
// handed back as it was; the synth that plays an alternative, or the transcribed part, over that
// loop; the top bar's Fixing line, the key line under the notation and the Fix dock.

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
  const latest = useRef({ practice, queue, spot, onLeave })
  latest.current = { practice, queue, spot, onLeave }

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
        output: () => {
          const engine = latest.current.practice.audio.engine
          return engine && { context: engine.context, input: engine.input }
        },
        read: () => {
          const { audio: engine, player: now } = latest.current.practice
          return {
            position: engine.position(),
            rate: now.speedPct / 100,
            playing: engine.playing(),
            loop: now.loop && now.loopOn ? { start: now.loop.start, end: now.loop.end } : null,
          }
        },
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

// The top bar's centre in Fix mode (s47 direction §6): "Fixing · every change saves as you go"
// as a glyph and words (never a tinted pill), then Undo and Redo side by side (⌘Z / ⇧⌘Z) and
// Done (Esc). Done is an outline control: Play stays the screen's one filled control.
export function FixPill({ onDone = leaveFix }: { onDone?: () => void }) {
  const { undo, redo } = usePractice()
  const undoCount = useCorrections((s) => s.undo.length)
  const redoCount = useCorrections((s) => s.redo.length)
  return (
    <div data-slot="fix-pill" className="flex min-w-0 items-center gap-1">
      <span className="flex min-w-0 items-center gap-2 pr-2 text-label text-foreground">
        <PencilIcon aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />
        <span className="truncate max-lg:hidden">{m['fix.fixing']()}</span>
        <span className="lg:hidden">{m['fix.fixing_short']()}</span>
      </span>
      <Button
        variant="quiet"
        size="icon"
        aria-label={m['editor.undo']()}
        aria-keyshortcuts="Meta+Z Control+Z"
        disabled={undoCount === 0}
        onClick={() => undo()}
      >
        <Undo2Icon aria-hidden />
      </Button>
      <Button
        variant="quiet"
        size="icon"
        aria-label={m['editor.redo']()}
        aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
        disabled={redoCount === 0}
        onClick={() => redo()}
      >
        <Redo2Icon aria-hidden />
      </Button>
      <Button variant="outline" shortcut={m['fix.key_escape']()} onClick={onDone}>
        {m['fix.done']()}
      </Button>
    </div>
  )
}

// The key line under the notation in Fix mode: what the marks mean, as samples drawn the way the
// notation draws them (ink digits; unsure a dashed edge and "?", probably a dotted edge, edited an
// underline), and the keys. The full editor adds its own: ← / → for notes and Delete.
export function FixKey({ editor = false }: { editor?: boolean }) {
  const { music, view } = usePractice()
  const sample =
    'inline-flex min-w-6 items-center justify-center rounded-media px-0.5 font-reading-mono leading-5 text-foreground'
  // How often the song's unsure marks are wrong, from their own confidences.
  const n = useMemo(() => {
    if (!music || !view) return null
    const low = (ids: Set<string>, all: readonly { id: string; confidence: number }[]) =>
      all.filter((item) => ids.has(item.id)).map((item) => item.confidence)
    const chords = new Set(view.chords.filter((c) => c.confidence === 'low').map((c) => c.id))
    const notes = new Set(view.notes.filter((n) => n.confidence === 'low').map((n) => n.id))
    return wrongOneIn([...low(chords, music.displayChords), ...low(notes, music.tab?.notes ?? [])])
  }, [music, view])
  const keys: [string[], string][] = [
    [[keyLabel('j'), keyLabel('k')], m['fix.key_keys']()],
    [[keyLabel('y')], m['fix.key_accept']()],
    ...(editor
      ? ([
          [[keyLabel('ArrowLeft'), keyLabel('ArrowRight')], m['fix.key_notes']()],
          [[m['fix.key_delete']()], m['editor.delete_note']()],
        ] as [string[], string][])
      : []),
  ]
  return (
    <div
      data-slot="fix-key"
      className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-border bg-paper px-4 py-1 text-body-sm text-muted-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={cn(sample, 'gap-0.5 border-[1.5px] border-dashed border-conf-low-edge')}
        >
          3<span className="text-caption text-conf-low-edge">?</span>
        </span>
        <span>{m['fix.key_unsure']({ n: String(n ?? 3) })}</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={cn(sample, 'border-[1.5px] border-dotted border-conf-medium-edge')}
        >
          5
        </span>
        <span>{m['practice.probably']()}</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={cn(sample, 'underline decoration-edited decoration-2 underline-offset-4')}
        >
          7
        </span>
        <span>{m['practice.edited']()}</span>
      </span>
      {keys.map(([caps, text]) => (
        <span key={text} className="inline-flex items-center gap-1.5 pointer-coarse:hidden">
          {caps.map((cap) => (
            <Kbd key={cap}>{cap}</Kbd>
          ))}
          <span>{text}</span>
        </span>
      ))}
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

// The Fix dock (27 §3.7.4; 80 px), in the transport's place: Play for the selected bars (the one
// filled control, 64), what it plays, Listen to (Original · Your part · Tab synth · Both: the
// recording against what was transcribed, the one chosen with the ink edge) and the Fix speed
// − / + with their keys, as on the transport.
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
      className="flex h-20 shrink-0 items-center gap-3 border-t border-border bg-background px-4"
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
      <div className="flex min-w-0 flex-col">
        {bar !== undefined && endBar !== undefined && (
          <span className="text-title whitespace-nowrap tabular-nums">
            {many
              ? m['fix.bars']({ bars: barsLabel(bar, endBar) })
              : m['fix.bar_one']({ bar: barLabel(bar) })}
          </span>
        )}
        <span className="truncate text-caption text-muted-foreground max-lg:hidden">
          {m['fix.dock_hint']()}
        </span>
      </div>
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
            <ToggleGroupItem key={choice} value={choice} className="min-h-target-practice">
              {LISTEN_LABEL[choice]()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <fieldset
        aria-label={m['practice.speed']()}
        className="m-0 flex items-center gap-1 border-0 p-0"
        data-slot="fix-speed"
      >
        <TransportButton
          tone="box"
          icon={<MinusIcon aria-hidden />}
          label={m['shortcuts.slower']()}
          showLabel={false}
          shortcut=","
          disabled={player.speedPct <= 50}
          onClick={() => speed(-5)}
        />
        <span aria-live="polite" className="w-16 text-center text-title tabular-nums">
          {formatPercent(player.speedPct)}
        </span>
        <TransportButton
          tone="box"
          icon={<PlusIcon aria-hidden />}
          label={m['shortcuts.faster']()}
          showLabel={false}
          shortcut="."
          disabled={player.speedPct >= 100}
          onClick={() => speed(5)}
        />
      </fieldset>
    </div>
  )
}
