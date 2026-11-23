import { PPQ, tickToTime, timeToTick } from '@splitune/music-core'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  HeadphonesIcon,
  PlayIcon,
  ScissorsIcon,
  Trash2Icon,
} from 'lucide-react'
import type * as React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { ChordSymbol, chordText } from '@/ui/chord-chip'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { NumberField } from '@/ui/number-field'
import { PanelSection } from '@/ui/panel'
import { useFix } from './fix-store'
import { playOnce } from './fix-synth'
import { keyLabel } from './input-mapper'
import { parseChordInput } from './model/chord-input'
import {
  beatFix,
  deleteNote,
  markCorrect,
  placeNote,
  replaceAll,
  reportWrong,
  setChord,
  setNoteEnd,
  splitChord,
} from './model/edits'
import { oneIn, wrongOneIn } from './model/frequency'
import { noteEvents } from './model/synth-schedule'
import { type ChordModel, chordsInBar, type NoteModel, spelledNote } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The Fix components (26 §5, §12.2; 27 §3.7.4; s47 direction §7): the spot header (FixQueue)
// with where the selection sits in the queue and previous / next (K / J); the chord section — the
// guess, how often a guess like it is wrong, the other likely chords as frequencies with "Hear over
// the loop" and Use (AlternativeRow), Type a chord and Split; the note section — the notes of the
// bar, "or play it as", String and Fret, Length, It's right, Delete note, Report wrong; and the
// metronome fixes with their consequence line. The Fix tab, the touch editor sheet and the full
// editor are built from them. Sections are divided by hairlines, never boxed.
//
// Confidence is shape, never hue alone: unsure is a dashed edge and "?", probably a dotted edge,
// edited a 2 px underline, and every digit and chord name stays ink. The suggested fix of the spot
// (its first alternative, else "It's right") carries `data-fix-primary` and the Y key cap: Y and
// the button are one path. `data-fix-focus` marks the spot's first action, which a key's
// selection focuses so Enter hears or confirms it. Every change is a correction op, applied at
// once, named in the toast with Undo.

/** The bar as the UI names it (1-based; the pickup by name). */
export const barLabel = (bar: number) => (bar < 0 ? m['practice.pickup']() : String(bar + 1))

/** "27" or "27–28". */
export const barsLabel = (bar: number, endBar: number = bar) =>
  endBar > bar ? `${barLabel(bar)}–${barLabel(endBar)}` : barLabel(bar)

/** The suggested fix's marks: the Y key cap, and the attribute Y clicks (input-mapper.ts). */
const accept = (on: boolean) => (on ? { shortcut: keyLabel('y'), 'data-fix-primary': '' } : {})

const barsOf = (bar: number, endBar: number = bar) =>
  Array.from({ length: Math.max(1, endBar - bar + 1) }, (_, i) => bar + i)

export interface Selection {
  bar: number
  endBar?: number | undefined
  chordId?: string | undefined
  noteId?: string | undefined
}

export type Select = (patch: { chordId?: string | undefined; noteId?: string | undefined }) => void

/** The section's quiet head: what it is about, and an action at the end of the line. */
function Head({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-target-practice items-center justify-between gap-2">
      <h4 className="text-label-sm text-muted-foreground tabular-nums">{title}</h4>
      {action}
    </div>
  )
}

// FixQueue (26 §12.2): "Spot 2 of 6 · bar 27–28" over an ink line showing how far through the
// queue the selection is, with previous (K) and next (J).
export function SpotHeader({
  title,
  position,
  total,
  onStep,
}: {
  title: string
  /** 1-based place in the queue; 0 when the selection isn't an unsure spot. */
  position: number
  total: number
  onStep: (direction: 1 | -1) => void
}) {
  return (
    <div className="flex items-center gap-2" data-slot="fix-queue">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="text-title text-pretty tabular-nums">{title}</h3>
        {total > 0 && (
          <div
            role="progressbar"
            aria-label={m['practice.fix_unsure_count']({ count: String(total) })}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={position}
            className="h-1 overflow-hidden rounded-full bg-hover inset-ring inset-ring-border"
          >
            <div
              className="h-full origin-left rounded-full bg-foreground transition-transform duration-(--duration-base)"
              style={{ transform: `scaleX(${position / total})` }}
            />
          </div>
        )}
      </div>
      <Button
        variant="outline"
        size="practice"
        className="px-3"
        shortcut={keyLabel('k')}
        disabled={total === 0}
        onClick={() => onStep(-1)}
      >
        <ChevronLeftIcon aria-hidden />
        <span className="sr-only">{m['shortcuts.previous_unsure']()}</span>
      </Button>
      <Button
        variant="outline"
        size="practice"
        className="px-3"
        shortcut={keyLabel('j')}
        disabled={total === 0}
        onClick={() => onStep(1)}
      >
        <ChevronRightIcon aria-hidden />
        <span className="sr-only">{m['shortcuts.next_unsure']()}</span>
      </Button>
    </div>
  )
}

// AlternativeRow (26 §12.2): "Am7 · about 1 in 3", Hear over the loop, Use. The first row's Use
// is the spot's suggested fix (Y).
function AlternativeRow({
  name,
  prob,
  suggested,
  first,
  hearing,
  onHear,
  onUse,
}: {
  name: string
  prob: number
  /** The suggested fix: Y does it. */
  suggested: boolean
  /** The first row: its first action is where a key's selection puts focus. */
  first: boolean
  hearing: boolean
  /** Absent where nothing loops under the card (the touch editor sheet). */
  onHear?: (() => void) | undefined
  onUse: () => void
}) {
  const spoken = chordText(name)
  return (
    <li
      data-slot="alternative-row"
      className="flex min-h-target-practice items-center gap-2 border-b border-border last:border-b-0"
    >
      <span className="min-w-14 shrink-0 text-title">
        <ChordSymbol name={name} />
      </span>
      <span className="min-w-0 flex-1 text-body-sm text-muted-foreground tabular-nums">
        {m['fix.about_one_in']({ n: String(oneIn(prob)) })}
      </span>
      {onHear && (
        <Button
          variant={hearing ? 'selected' : 'quiet'}
          size="icon-practice"
          aria-pressed={hearing}
          aria-label={m['fix.hear_over_loop']({ chord: spoken })}
          data-fix-focus={first ? '' : undefined}
          onClick={onHear}
        >
          <HeadphonesIcon aria-hidden />
        </Button>
      )}
      <Button
        size="practice"
        variant="outline"
        {...accept(suggested)}
        data-fix-focus={first && !onHear ? '' : undefined}
        onClick={onUse}
      >
        <span aria-hidden>{m['fix.use']()}</span>
        <span className="sr-only">{m['fix.use_named']({ chord: spoken })}</span>
      </Button>
    </li>
  )
}

export function ChordCard({
  bar,
  endBar,
  chordId,
  onSelect,
  active = true,
}: Selection & {
  onSelect: Select
  /** The spot is about this chord: its suggested fix answers Y. */
  active?: boolean
}) {
  const practice = usePractice()
  const { grid, view, music, data, edit, editAll } = practice
  const fixing = usePracticeUi((s) => s.fixing)
  const audition = useFix((s) => s.audition)
  const replaceable = useFix((s) => s.replaceable)
  if (!grid || !view) return null
  const chords = [
    ...new Map(
      barsOf(bar, endBar)
        .flatMap((b) => chordsInBar(view.chords, grid, b))
        .map((c) => [c.id, c]),
    ).values(),
  ]
  const chord = chords.find((c) => c.id === chordId) ?? chords[0]
  const segments = music?.chords?.segments ?? []
  const segment = chord ? segments.find((s) => s.id === chord.id) : undefined
  if (!chord || !segment) return null

  const at = barLabel(chord.bar)
  const title = chord.bar < 0 ? m['fix.pickup_chord']() : m['fix.bar_chord']({ bar: at })
  const edited = data.ops.chords.ops.some(
    (op) =>
      (op.op === 'set_chord' || op.op === 'split_chord') &&
      (op.segment_id === chord.id || chord.id.startsWith(`${op.segment_id}.`)),
  )
  const raw = music?.displayChords.find((c) => c.id === chord.id)?.confidence
  const guessed = chord.confidence !== 'high' && raw !== undefined ? wrongOneIn(raw) : null
  const unsure = chord.confidence !== 'high'
  const alternatives = chord.alternatives.slice(0, 4)
  // Where a second chord most likely starts: the beat of the chord's first bar nearest the middle
  // of what it holds of that bar.
  const barEnd = Math.min(segment.t1, grid.barEnd(chord.bar))
  const middle = (Math.max(segment.t0, grid.barStart(chord.bar)) + barEnd) / 2
  const split = grid
    .beatsOf(chord.bar)
    .map((t, i) => ({ t, beat: i + 1 }))
    .filter(({ t }) => t > segment.t0 + 1e-3 && t < segment.t1 - 1e-3)
    .sort((x, y) => Math.abs(x.t - middle) - Math.abs(y.t - middle))[0]

  const change = (to: { label: string; bass?: string | undefined }, toName: string) => {
    const next = setChord(segment, to.label)
    if (to.bass !== undefined && next.op.op === 'set_chord') next.op.bass = to.bass
    edit(
      next,
      m['fix.detail_chord']({ bar: at, from: chordText(chord.name), to: chordText(toName) }),
    )
    useFix.setState({
      audition: null,
      replaceable: {
        from: { id: segment.id, label: segment.label, bass: segment.bass },
        to,
        fromName: chordText(chord.name),
        toName: chordText(toName),
      },
    })
  }
  // "Replace all in this song" (12 §4): offered right after a change, while other bars still
  // hold the chord this one had.
  const others =
    replaceable?.from.id === segment.id
      ? replaceAll(segments, replaceable.from, replaceable.to)
      : []

  return (
    <PanelSection aria-label={title} data-slot="chord-card" className="gap-2">
      <Head
        title={title}
        action={
          <Button variant="quiet" size="sm" onClick={() => practice.hearBar(chord.bar)}>
            <PlayIcon aria-hidden />
            {m['fix.hear_bar']()}
          </Button>
        }
      />
      {chords.length > 1 && (
        <ul
          aria-label={m['fix.chords_in_bar']()}
          className="m-0 flex list-none flex-wrap gap-1 p-0"
        >
          {chords.map((c) => (
            <li key={c.id}>
              <Chip
                selected={c.id === chord.id}
                confidence={c.confidence}
                aria-label={chordText(c.name)}
                onClick={() => onSelect({ chordId: c.id })}
              >
                <ChordSymbol name={c.name} />
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-4 py-1">
        <Guess chord={chord} edited={edited} />
        {(guessed !== null || edited) && (
          <p className="min-w-0 text-body-sm text-muted-foreground">
            {guessed !== null
              ? m['fix.first_guess']({ n: String(guessed) })
              : m['practice.edited']()}
          </p>
        )}
      </div>
      {alternatives.length > 0 && (
        <div className="flex flex-col">
          <p className="text-label-sm text-muted-foreground">{m['editor.alternatives']()}</p>
          <ul className="m-0 flex list-none flex-col p-0">
            {alternatives.map((alt, index) => {
              const hearing = audition?.chordId === chord.id && audition.label === alt.label
              const hear = () => {
                useFix.setState({
                  audition: hearing ? null : { chordId: chord.id, label: alt.label },
                })
                if (!hearing && (practice.state === 'ready' || practice.state === 'paused')) {
                  practice.send({ type: 'PLAY' })
                }
              }
              return (
                <AlternativeRow
                  key={alt.label}
                  name={alt.name}
                  prob={alt.prob}
                  suggested={active && index === 0}
                  first={index === 0}
                  hearing={hearing}
                  onHear={fixing ? hear : undefined}
                  onUse={() => change({ label: alt.label }, alt.name)}
                />
              )
            })}
          </ul>
        </div>
      )}
      {others.length > 0 && replaceable && (
        <div className="flex flex-col items-start gap-1" data-slot="replace-all">
          <p className="text-body-sm text-muted-foreground">
            {m['fix.replace_all_hint']({
              chord: replaceable.fromName,
              to: replaceable.toName,
              count: String(others.length),
            })}
          </p>
          <Button
            size="practice"
            variant="outline"
            onClick={() => {
              editAll(
                others,
                m['fix.detail_replaced']({
                  from: replaceable.fromName,
                  to: replaceable.toName,
                  count: String(others.length),
                }),
              )
              useFix.setState({ replaceable: null })
            }}
          >
            {m['fix.replace_all']()}
          </Button>
        </div>
      )}
      <TypeChord
        splitBeat={split?.beat}
        onChord={change}
        onSplit={(parsed) => {
          if (!split) return
          edit(
            splitChord(segment, segments, split.t, parsed.label),
            m['fix.detail_bar']({ bar: at }),
          )
        }}
      />
      <div className="flex flex-wrap gap-2">
        {unsure && (
          <Button
            size="practice"
            variant="outline"
            {...accept(active && alternatives.length === 0)}
            data-fix-focus={alternatives.length === 0 ? '' : undefined}
            onClick={() =>
              edit(markCorrect('chords', segment.id), m['fix.detail_bar']({ bar: at }))
            }
          >
            <CheckIcon aria-hidden />
            {m['fix.its_right']()}
          </Button>
        )}
        <Button
          size="practice"
          variant="quiet"
          onClick={() => edit(reportWrong('chords', segment.id))}
        >
          <FlagIcon aria-hidden />
          {m['editor.report_wrong']()}
        </Button>
      </div>
    </PanelSection>
  )
}

/** The mark of a confidence (26 §5): dashed and "?" for unsure, dotted for probably. */
const MARK = {
  low: 'outline-[1.5px] outline-offset-4 outline-conf-low-edge outline-dashed',
  medium: 'outline-[1.5px] outline-offset-4 outline-conf-medium-edge outline-dotted',
  high: '',
} as const

// The guess (26 §5): ink in every state; unsure has a dashed edge and "?", probably a dotted
// edge, edited a 2 px underline. With the marks hidden (U) it is plain ink.
function Guess({ chord, edited }: { chord: ChordModel; edited: boolean }) {
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const mark = showUncertainty ? chord.confidence : 'high'
  return (
    <span
      data-slot="chord-guess"
      data-confidence={chord.confidence}
      className={cn(
        'shrink-0 rounded-media px-1 text-readout whitespace-nowrap text-foreground',
        MARK[mark],
        edited && 'underline decoration-edited decoration-2 underline-offset-4',
      )}
    >
      <ChordSymbol name={chord.name} />
      {mark === 'low' && (
        <span aria-hidden className="ml-1 align-super text-label-sm text-conf-low-edge">
          ?
        </span>
      )}
      {chord.confidence !== 'high' && (
        <span className="sr-only">
          , {chord.confidence === 'low' ? m['practice.unsure']() : m['practice.probably']()}
        </span>
      )}
    </span>
  )
}

// A chord or note of the selection: a pill painted inside the practice target. Its edge says its
// confidence (dashed and "?" unsure, dotted probably, the hairline when sure); the chosen one has
// the 1.5 px ink edge. Text stays ink.
function Chip({
  selected,
  confidence = 'high',
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  selected?: boolean
  confidence?: 'low' | 'medium' | 'high'
}) {
  return (
    <button
      type="button"
      data-slot="fix-chip"
      data-confidence={confidence}
      aria-pressed={selected}
      className={cn(
        'group/chip inline-flex min-h-target-practice items-center rounded-full focus-visible:outline-offset-[-4px]',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-label-sm whitespace-nowrap text-foreground tabular-nums transition-colors duration-(--duration-fast) group-hover/chip:bg-hover',
          confidence === 'low' && 'border-[1.5px] border-dashed border-conf-low-edge',
          confidence === 'medium' && 'border-[1.5px] border-dotted border-conf-medium-edge',
          confidence === 'high' && 'border-border-strong',
          'group-aria-pressed/chip:inset-ring-[1.5px] group-aria-pressed/chip:inset-ring-selected',
        )}
      >
        {children}
        {confidence === 'low' && (
          <span aria-hidden className="text-conf-low-edge">
            ?
          </span>
        )}
      </span>
    </button>
  )
}

function TypeChord({
  splitBeat,
  onChord,
  onSplit,
}: {
  /** The beat a split would start the typed chord on; none when the chord is one beat long. */
  splitBeat: number | undefined
  onChord: (chord: { label: string; bass?: string }, name: string) => void
  onSplit: (chord: { label: string; bass?: string }) => void
}) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const id = useId()
  const hintId = useId()
  const errorId = useId()
  const parsed = parseChordInput(text)
  const submit = (then: (chord: { label: string; bass?: string }, name: string) => void) => {
    if (!parsed) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    then(parsed, text.trim())
    setText('')
  }
  return (
    <form
      className="flex flex-col gap-1.5 pt-1"
      onSubmit={(event) => {
        event.preventDefault()
        submit(onChord)
      }}
    >
      <Label htmlFor={id}>{m['editor.type_chord']()}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={id}
          value={text}
          enterKeyHint="done"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : hintId}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => setInvalid(text.trim() !== '' && !parsed)}
          className="min-w-0 flex-1 basis-32"
        />
        {splitBeat !== undefined && (
          <Button type="button" variant="outline" onClick={() => submit(onSplit)}>
            <ScissorsIcon aria-hidden />
            {m['fix.split_at']({ beat: String(splitBeat) })}
          </Button>
        )}
      </div>
      {invalid ? (
        <p id={errorId} className="text-body-sm text-destructive">
          {m['editor.chord_invalid']()}
        </p>
      ) : (
        <p id={hintId} className="text-body-sm text-muted-foreground">
          {m['fix.type_chord_hint']()}
        </p>
      )}
    </form>
  )
}

export function NoteCard({
  bar,
  endBar,
  noteId,
  onSelect,
  active = true,
}: Selection & {
  onSelect: Select
  /** The spot is about these notes: its suggested fix answers Y. */
  active?: boolean
}) {
  const practice = usePractice()
  const { grid, view, music, edit, editAll, player, audio } = practice
  const volumePct = usePracticeDefaults((s) => s.volumePct)
  if (!grid || !view) return null
  const last = endBar ?? bar
  const notes = view.notes
    .filter((n) => n.bar >= bar && n.bar <= last)
    .sort((a, b) => a.onset - b.onset)
  if (notes.length === 0) return null
  const note = notes.find((n) => n.id === noteId)
  const names = music?.noteNames ?? []
  const tuning = music?.tab?.tuningMidi ?? []
  const effective = note ? music?.tab?.notes.find((n) => n.id === note.id) : undefined
  const event = note ? music?.tab?.events.find((e) => e.note_id === note.id) : undefined
  const placed =
    note && note.string !== undefined && note.fret !== undefined
      ? { string: note.string, fret: note.fret }
      : undefined
  const at = barLabel(note?.bar ?? bar)
  // A shaky bar (26 §5) is one spot: fixed note by note, or confirmed whole.
  const unsureInBar = notes.filter((n) => n.bar === bar && n.confidence === 'low')
  const shaky = !note && view.unsureBars.has(bar) && unsureInBar.length > 0
  const shakyIds = new Set(unsureInBar.map((n) => n.id))
  const shakyN = shaky
    ? wrongOneIn(
        (music?.tab?.notes ?? []).filter((n) => shakyIds.has(n.id)).map((n) => n.confidence),
      )
    : null
  const nth = note ? String(notes.filter((n) => n.bar === note.bar).indexOf(note) + 1) : ''
  // The pickup is named as itself ("Pickup · note 2"), never "Bar Pickup".
  const title = note
    ? note.bar < 0
      ? m['fix.pickup_note']({ n: nth })
      : m['fix.bar_note']({ bar: at, n: nth })
    : bar < 0 && last === bar
      ? m['fix.pickup_notes']()
      : m['fix.bar_notes']({ bar: barsLabel(bar, last) })
  const confirmable = (note && note.confidence !== 'high') || shaky

  const place = (to: { string: number; fret: number }) => {
    if (!effective || !placed) return
    const next = placeNote(effective, placed, to, tuning)
    if (!next) return
    edit(
      next,
      m['fix.detail_fingering']({ bar: at, string: String(to.string), fret: String(to.fret) }),
    )
  }

  return (
    <PanelSection aria-label={title} data-slot="note-card" className="gap-2">
      <Head
        title={title}
        action={
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              practice.send({ type: 'PAUSE' })
              void playOnce(noteEvents(notes), grid.barStart(bar), player.speedPct / 100, {
                context: () => audio.engine?.context ?? null,
                volume: () => (volumePct / 100) ** 2,
              })
            }}
          >
            <PlayIcon aria-hidden />
            {m['editor.hear_tab']()}
          </Button>
        }
      />
      {shakyN !== null && (
        <p className="text-body-sm text-muted-foreground">
          {m['fix.shaky_bar']({ n: String(shakyN) })}
        </p>
      )}
      <ul aria-label={m['fix.notes_in_bar']()} className="m-0 flex list-none flex-wrap gap-1 p-0">
        {notes.map((n) => (
          <li key={n.id}>
            <Chip
              selected={n.id === note?.id}
              confidence={n.confidence}
              aria-label={
                n.confidence === 'low'
                  ? `${noteText(n, names)}, ${m['practice.unsure']()}`
                  : noteText(n, names)
              }
              onClick={() => onSelect({ noteId: n.id })}
            >
              {noteText(n, names)}
            </Chip>
          </li>
        ))}
      </ul>
      {note && placed && (event?.alt_fingerings?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-x-1">
          <span className="pr-1 text-body-sm text-muted-foreground">{m['fix.or_play_as']()}</span>
          {event?.alt_fingerings?.map((alt) => (
            <Chip
              key={`${alt.string}-${alt.fret}`}
              onClick={() => place({ string: alt.string, fret: alt.fret })}
            >
              {m['fix.fingering']({ string: String(alt.string), fret: String(alt.fret) })}
            </Chip>
          ))}
        </div>
      )}
      {note && effective && placed && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stepper
              label={m['editor.string']()}
              down={m['editor.string_down']()}
              up={m['editor.string_up']()}
              value={placed.string}
              min={1}
              max={tuning.length}
              onChange={(string) => place({ string, fret: note.pitch - (tuning[string - 1] ?? 0) })}
            />
            <Stepper
              label={m['editor.fret']()}
              down={m['editor.fret_down']()}
              up={m['editor.fret_up']()}
              value={placed.fret}
              min={0}
              max={24}
              onChange={(fret) => place({ string: placed.string, fret })}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="flex-1 text-label-sm text-muted-foreground">
              {m['editor.length']()}
            </span>
            {([-1, 1] as const).map((direction) => (
              <Button
                key={direction}
                size="practice"
                variant="quiet"
                onClick={() => {
                  const tick = timeToTick(grid.grid, effective.offset_s) + (direction * PPQ) / 4
                  const next = setNoteEnd(effective, tickToTime(grid.grid, tick))
                  if (next) edit(next, m['fix.detail_bar']({ bar: at }))
                }}
              >
                {direction === -1 ? m['editor.shorter']() : m['editor.longer']()}
              </Button>
            ))}
          </div>
        </>
      )}
      {(note || shaky) && (
        <div className="flex flex-wrap gap-2">
          {confirmable && (
            <Button
              size="practice"
              variant="outline"
              {...accept(active)}
              data-fix-focus=""
              onClick={() =>
                note
                  ? edit(markCorrect('notes', note.id), m['fix.detail_bar']({ bar: at }))
                  : editAll(
                      unsureInBar.map((n) => markCorrect('notes', n.id)),
                      m['fix.detail_bar']({ bar: at }),
                    )
              }
            >
              <CheckIcon aria-hidden />
              {m['fix.its_right']()}
            </Button>
          )}
          {note && effective && (
            <>
              <Button
                size="practice"
                variant="quiet"
                onClick={() => edit(reportWrong('notes', note.id))}
              >
                <FlagIcon aria-hidden />
                {m['editor.report_wrong']()}
              </Button>
              <Button
                size="practice"
                variant="destructive"
                className="ml-auto"
                onClick={() => {
                  edit(deleteNote(effective), m['fix.detail_bar']({ bar: at }))
                  onSelect({ noteId: undefined })
                }}
              >
                <Trash2Icon aria-hidden />
                {m['editor.delete_note']()}
              </Button>
            </>
          )}
        </div>
      )}
    </PanelSection>
  )
}

/** "D4 · string 2, fret 3", the pitch spelled in the song's key. */
function noteText(note: NoteModel, names: readonly string[]): string {
  return m['editor.note_label']({
    note: spelledNote(note.pitch, names),
    string: String(note.string ?? '–'),
    fret: String(note.fret ?? '–'),
  })
}

function Stepper({
  label,
  down,
  up,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  down: string
  up: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span aria-hidden className="text-label-sm text-muted-foreground">
        {label}
      </span>
      <NumberField
        fill
        value={value}
        min={min}
        max={max}
        step={1}
        inputLabel={label}
        decrementLabel={down}
        incrementLabel={up}
        onValueChange={(next) => next !== null && next !== value && onChange(next)}
      />
    </div>
  )
}

// Beat fixes (12 §4, §10): one tap halves or doubles the tempo grid or moves the downbeat; the
// song is re-barred in the browser and a line says what that did, with Undo.
export function BeatFixes() {
  const { edit, undo, grid } = usePractice()
  const titleId = useId()
  const started = useRef<number | null>(null)
  const [result, setResult] = useState<{ bars: number; ms: number } | null>(null)
  useEffect(() => {
    if (started.current === null || !grid) return
    setResult({ bars: grid.bars.length, ms: performance.now() - started.current })
    started.current = null
  }, [grid])
  const fix = (kind: 'half' | 'double' | 'shift') => {
    started.current = performance.now()
    setResult(null)
    edit(beatFix(kind))
  }
  return (
    <PanelSection
      aria-labelledby={titleId}
      title={<span id={titleId}>{m['practice.beat_off']()}</span>}
      data-slot="beat-fixes"
      className="gap-2"
    >
      <div className="flex flex-wrap gap-1">
        <Button size="practice" variant="quiet" onClick={() => fix('half')}>
          {m['practice.half_tempo']()}
        </Button>
        <Button size="practice" variant="quiet" onClick={() => fix('double')}>
          {m['practice.double_tempo']()}
        </Button>
        <Button size="practice" variant="quiet" onClick={() => fix('shift')}>
          {m['practice.move_downbeat']()}
        </Button>
      </div>
      {result && (
        <div
          role="status"
          data-slot="rebarred"
          data-requantize-ms={result.ms.toFixed(0)}
          className="flex items-center gap-2 text-body-sm text-muted-foreground tabular-nums"
        >
          <span className="flex-1">{m['fix.rebarred']({ n: String(result.bars) })}</span>
          <Button
            size="practice"
            variant="quiet"
            onClick={() => {
              undo()
              setResult(null)
            }}
          >
            {m['editor.undo']()}
          </Button>
        </div>
      )}
    </PanelSection>
  )
}
