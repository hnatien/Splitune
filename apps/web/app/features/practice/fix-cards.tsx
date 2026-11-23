import { PPQ, tickToTime, timeToTick } from '@splitune/music-core'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  HeadphonesIcon,
  PlayIcon,
  ScissorsIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { ChordSymbol, chordText } from '@/ui/chord-chip'
import { Input } from '@/ui/input'
import { NumberField } from '@/ui/number-field'
import { useFix } from './fix-store'
import { playOnce } from './fix-synth'
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

// The Fix components (26 §12.2, 27 §3.7.4, Practice-Fix.dc.html): the spot header (FixQueue) with
// its --unsure progress and previous / next; the chord card — the guess, how often a guess like it
// is wrong, the other likely chords as frequencies with "Hear over the loop" and Use
// (AlternativeRow), Type a chord and Split; the note card — the note, "or play it as", String and
// Fret, It's right, Delete note, Report wrong; and the metronome fixes with their consequence
// line. The Fix tab, the tablet's editor sheet and the desktop editor are built from them. Every
// change is a correction op, applied at once, named in the toast with Undo.

export const eyebrow = 'text-body-sm text-muted-foreground'
const card = 'flex flex-col gap-2.5 rounded-field border border-border bg-raised p-3.5'

/** The bar as the UI names it (1-based; the pickup by name). */
export const barLabel = (bar: number) => (bar < 0 ? m['practice.pickup']() : String(bar + 1))

/** "27" or "27–28". */
export const barsLabel = (bar: number, endBar: number = bar) =>
  endBar > bar ? `${barLabel(bar)}–${barLabel(endBar)}` : barLabel(bar)

const barsOf = (bar: number, endBar: number = bar) =>
  Array.from({ length: Math.max(1, endBar - bar + 1) }, (_, i) => bar + i)

export interface Selection {
  bar: number
  endBar?: number | undefined
  chordId?: string | undefined
  noteId?: string | undefined
}

export type Select = (patch: { chordId?: string | undefined; noteId?: string | undefined }) => void

// FixQueue (26 §12.2): "Spot 2 of 6 · bar 27–28" over a --unsure progress, with previous / next.
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
    <div className="flex items-center gap-2.5" data-slot="fix-queue">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="truncate text-title tabular-nums">{title}</h3>
        {total > 0 && (
          <div
            role="progressbar"
            aria-label={m['practice.fix_unsure_count']({ count: String(total) })}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={position}
            className="h-1.5 overflow-hidden rounded-full bg-hover"
          >
            <div
              className="h-full origin-left rounded-full bg-unsure transition-transform duration-(--duration-base)"
              style={{ transform: `scaleX(${position / total})` }}
            />
          </div>
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        aria-label={m['shortcuts.previous_unsure']()}
        disabled={total === 0}
        onClick={() => onStep(-1)}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={m['shortcuts.next_unsure']()}
        disabled={total === 0}
        onClick={() => onStep(1)}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  )
}

// AlternativeRow (26 §12.2): "Am7 · about 1 in 3", Hear over the loop, Use. The first row's Use is
// the card's one primary action.
function AlternativeRow({
  name,
  prob,
  primary,
  hearing,
  onHear,
  onUse,
}: {
  name: string
  prob: number
  primary: boolean
  hearing: boolean
  /** Absent where nothing loops under the card (the tablet's editor sheet). */
  onHear?: (() => void) | undefined
  onUse: () => void
}) {
  const spoken = chordText(name)
  return (
    <li data-slot="alternative-row" className="flex items-center gap-2.5 py-1.5">
      <span className="min-w-14 shrink-0 text-title font-medium">
        <ChordSymbol name={name} />
      </span>
      <span className="min-w-0 flex-1 text-body-sm text-muted-foreground tabular-nums">
        {m['fix.about_one_in']({ n: String(oneIn(prob)) })}
      </span>
      {onHear && (
        <Button
          variant={hearing ? 'selected' : 'quiet'}
          size="icon"
          aria-pressed={hearing}
          aria-label={m['fix.hear_over_loop']({ chord: spoken })}
          data-fix-primary={primary ? '' : undefined}
          onClick={onHear}
        >
          <HeadphonesIcon aria-hidden />
        </Button>
      )}
      <Button
        size="sm"
        variant={primary ? 'primary' : 'outline'}
        aria-label={m['fix.use_named']({ chord: spoken })}
        data-fix-primary={primary && !onHear ? '' : undefined}
        onClick={onUse}
      >
        {m['fix.use']()}
      </Button>
    </li>
  )
}

export function ChordCard({ bar, endBar, chordId, onSelect }: Selection & { onSelect: Select }) {
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
  const edited = data.ops.chords.ops.some(
    (op) =>
      (op.op === 'set_chord' || op.op === 'split_chord') &&
      (op.segment_id === chord.id || chord.id.startsWith(`${op.segment_id}.`)),
  )
  const raw = music?.displayChords.find((c) => c.id === chord.id)?.confidence
  const guessed = chord.confidence !== 'high' && raw !== undefined ? wrongOneIn(raw) : null
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
    <section aria-label={m['fix.bar_chord']({ bar: at })} className={card} data-slot="chord-card">
      <div className="flex items-center justify-between gap-2">
        <span className={cn(eyebrow, 'tabular-nums')}>{m['fix.bar_chord']({ bar: at })}</span>
        <Button variant="quiet" size="sm" onClick={() => practice.hearBar(chord.bar)}>
          <PlayIcon aria-hidden />
          {m['fix.hear_bar']()}
        </Button>
      </div>
      {chords.length > 1 && (
        <ul aria-label={m['fix.chords_in_bar']()} className="-my-1 flex flex-wrap gap-x-1.5">
          {chords.map((c) => (
            <li key={c.id}>
              <Chip
                selected={c.id === chord.id}
                unsure={c.confidence === 'low'}
                dashed={c.confidence !== 'high'}
                aria-label={chordText(c.name)}
                onClick={() => onSelect({ chordId: c.id })}
              >
                <ChordSymbol name={c.name} />
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Guess chord={chord} edited={edited} />
        {(guessed !== null || edited) && (
          <p className="min-w-0 text-body-sm text-muted-foreground">
            {guessed !== null
              ? m['fix.first_guess']({ n: String(guessed) })
              : m['practice.edited']()}
          </p>
        )}
      </div>
      {chord.alternatives.length > 0 && (
        <>
          <p className="mt-1 text-body-sm text-faint-foreground">{m['editor.alternatives']()}</p>
          <ul className="-mt-1 flex flex-col divide-y divide-border">
            {chord.alternatives.slice(0, 4).map((alt, index) => {
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
                  primary={index === 0}
                  hearing={hearing}
                  onHear={fixing ? hear : undefined}
                  onUse={() => change({ label: alt.label }, alt.name)}
                />
              )
            })}
          </ul>
        </>
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
            size="sm"
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
      <div className="-my-1 flex flex-wrap gap-x-2">
        {chord.confidence !== 'high' && (
          <Button
            size="sm"
            variant="outline"
            data-fix-primary={chord.alternatives.length === 0 ? '' : undefined}
            onClick={() =>
              edit(markCorrect('chords', segment.id), m['fix.detail_bar']({ bar: at }))
            }
          >
            <CheckIcon aria-hidden />
            {m['fix.its_right']()}
          </Button>
        )}
        <Button size="sm" variant="quiet" onClick={() => edit(reportWrong('chords', segment.id))}>
          <FlagIcon aria-hidden />
          {m['editor.report_wrong']()}
        </Button>
      </div>
    </section>
  )
}

// The guess (26 §5): unsure in --unsure with a dashed outline and "?", probably with a dashed
// faint outline, edited underlined; never colour alone.
function Guess({ chord, edited }: { chord: ChordModel; edited: boolean }) {
  const showUncertainty = usePracticeDefaults((s) => s.showUncertainty)
  const low = showUncertainty && chord.confidence === 'low'
  const medium = showUncertainty && chord.confidence === 'medium'
  return (
    <span
      data-slot="chord-guess"
      data-confidence={chord.confidence}
      className={cn(
        'shrink-0 rounded-media px-1 text-hero leading-none font-medium whitespace-nowrap',
        low && 'text-unsure outline-[1.5px] outline-offset-4 outline-unsure outline-dashed',
        medium && 'outline-[1.5px] outline-offset-4 outline-conf-medium-edge outline-dashed',
        edited && 'text-edited underline decoration-2 underline-offset-[3px]',
      )}
    >
      <ChordSymbol name={chord.name} />
      {low && (
        <sup aria-hidden className="ml-0.5 text-caption font-medium">
          ?
        </sup>
      )}
      {chord.confidence !== 'high' && (
        <span className="sr-only">
          , {chord.confidence === 'low' ? m['practice.unsure']() : m['practice.probably']()}
        </span>
      )}
    </span>
  )
}

// `.chip` (26 §12.1): the pill is painted inside the control-size box; dashed when the mark is
// uncertain, with "?" and the --unsure ink when unsure (26 §5).
function Chip({
  selected,
  unsure = false,
  dashed = false,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { selected?: boolean; unsure?: boolean; dashed?: boolean }) {
  return (
    <button
      type="button"
      data-slot="fix-chip"
      aria-pressed={selected}
      className={cn('group/chip inline-flex min-h-control items-center rounded-full', className)}
      {...props}
    >
      <span
        className={cn(
          'inline-flex h-7.5 items-center gap-1 rounded-full border border-border-strong px-3 text-body-sm font-medium whitespace-nowrap tabular-nums transition-colors duration-(--duration-fast) group-hover/chip:bg-hover group-aria-pressed/chip:border-selected group-aria-pressed/chip:bg-wash group-aria-pressed/chip:text-foreground',
          dashed && 'border-[1.5px] border-dashed',
          unsure && 'border-unsure text-unsure',
        )}
      >
        {children}
        {unsure && <span aria-hidden>?</span>}
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
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        submit(onChord)
      }}
    >
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          {m['editor.type_chord']()}
        </label>
        <Input
          id={id}
          value={text}
          placeholder={m['fix.type_chord']()}
          enterKeyHint="done"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => setInvalid(text.trim() !== '' && !parsed)}
          className="min-w-0 flex-1"
        />
        {splitBeat !== undefined && (
          <Button type="button" variant="outline" onClick={() => submit(onSplit)}>
            <ScissorsIcon aria-hidden />
            {m['fix.split_at']({ beat: String(splitBeat) })}
          </Button>
        )}
      </div>
      {invalid && (
        <p id={errorId} className="text-body-sm text-destructive">
          {m['editor.chord_invalid']()}
        </p>
      )}
    </form>
  )
}

export function NoteCard({ bar, endBar, noteId, onSelect }: Selection & { onSelect: Select }) {
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
  const title = note
    ? m['fix.bar_note']({
        bar: at,
        n: String(notes.filter((n) => n.bar === note.bar).indexOf(note) + 1),
      })
    : m['fix.bar_notes']({ bar: barsLabel(bar, last) })

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
    <section aria-label={title} className={card} data-slot="note-card">
      <div className="flex items-center justify-between gap-2">
        <span className={cn(eyebrow, 'tabular-nums')}>{title}</span>
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
      </div>
      {shakyN !== null && (
        <p className="text-body-sm text-muted-foreground">
          {m['fix.shaky_bar']({ n: String(shakyN) })}
        </p>
      )}
      <ul aria-label={m['fix.notes_in_bar']()} className="-my-1 flex flex-wrap gap-x-1.5">
        {notes.map((n) => (
          <li key={n.id}>
            <Chip
              selected={n.id === note?.id}
              unsure={n.confidence === 'low'}
              dashed={n.confidence !== 'high'}
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
        <div className="-my-1 flex flex-wrap items-center gap-x-2">
          <span className="text-body-sm text-faint-foreground">{m['fix.or_play_as']()}</span>
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
          <div className="grid grid-cols-2 gap-2">
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
          <div className="-my-1 flex items-center gap-2">
            <span className="flex-1 text-body-sm font-medium text-muted-foreground">
              {m['editor.length']()}
            </span>
            {([-1, 1] as const).map((direction) => (
              <Button
                key={direction}
                size="sm"
                variant="outline"
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
        <div className="-my-1 flex flex-wrap gap-x-2">
          {note && note.confidence !== 'high' && (
            <Button
              size="sm"
              variant="outline"
              data-fix-primary=""
              onClick={() => edit(markCorrect('notes', note.id), m['fix.detail_bar']({ bar: at }))}
            >
              <CheckIcon aria-hidden />
              {m['fix.its_right']()}
            </Button>
          )}
          {shaky && (
            <Button
              size="sm"
              variant="outline"
              data-fix-primary=""
              onClick={() =>
                editAll(
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
                size="sm"
                variant="quiet"
                onClick={() => {
                  edit(deleteNote(effective), m['fix.detail_bar']({ bar: at }))
                  onSelect({ noteId: undefined })
                }}
              >
                {m['editor.delete_note']()}
              </Button>
              <Button size="sm" variant="quiet" onClick={() => edit(reportWrong('notes', note.id))}>
                <FlagIcon aria-hidden />
                {m['editor.report_wrong']()}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
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
    <div className="flex min-w-0 flex-col gap-1">
      <span aria-hidden className="text-body-sm font-medium text-muted-foreground">
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
    <section aria-labelledby={titleId} className="flex flex-col gap-2" data-slot="beat-fixes">
      <h3 id={titleId} className="text-body-sm font-normal text-muted-foreground">
        {m['practice.beat_off']()}
      </h3>
      <div className="-my-1.5 flex flex-wrap gap-x-2">
        <Button size="sm" variant="outline" onClick={() => fix('half')}>
          {m['practice.half_tempo']()}
        </Button>
        <Button size="sm" variant="outline" onClick={() => fix('double')}>
          {m['practice.double_tempo']()}
        </Button>
        <Button size="sm" variant="outline" onClick={() => fix('shift')}>
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
            size="sm"
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
    </section>
  )
}
