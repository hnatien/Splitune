import { chordShapes, PPQ, tickToTime, timeToTick, transposeChord } from '@splitune/music-core'
import { ChordDiagram } from '@splitune/notation'
import { useQuery } from '@tanstack/react-query'
import { FlagIcon, HeadphonesIcon, MusicIcon, ScissorsIcon, Trash2Icon } from 'lucide-react'
import { useId, useState } from 'react'
import { m } from '@/lib/i18n'
import { meQuery } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { NumberField } from '@/ui/number-field'
import { oneIn, parseChordInput } from './model/chord-input'
import {
  beatFix,
  deleteNote,
  placeNote,
  reportWrong,
  setChord,
  setNoteEnd,
  splitChord,
} from './model/edits'
import { chordsInBar, noteName } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'
import { playTabPreview } from './tab-preview'

// The editor (27 §3.7.4) for one bar: its chords with the top-k alternatives as frequencies
// ("Am7 · about 1 in 3"), "Type a chord", "Split at this beat"; its notes with string/fret
// steppers, length and delete; Hear this bar (original mix) / Hear the tab; Report wrong; and the
// metronome fixes. Every change is a correction op, applied at once, with Undo in the toast.

export function EditorContent({
  bar,
  chordId,
  noteId,
  onSelectNote,
}: {
  bar: number
  chordId?: string | undefined
  noteId?: string | undefined
  onSelectNote?: (noteId: string) => void
}) {
  const practice = usePractice()
  const { grid, view, music, edit, player, data } = practice
  const me = useQuery(meQuery)
  if (!grid || !view) return null
  const chords = chordsInBar(view.chords, grid, bar)
  const chord = chords.find((c) => c.id === chordId) ?? chords[0]
  const notes = view.notes.filter((n) => n.bar === bar).sort((a, b) => a.onset - b.onset)
  const note = notes.find((n) => n.id === noteId)
  const segments = music?.chords?.segments ?? []
  const segment = chord ? segments.find((s) => s.id === chord.id) : undefined
  const effectiveNote = note ? music?.tab?.notes.find((n) => n.id === note.id) : undefined
  const tuning = music?.tab?.tuningMidi ?? []
  const capo = music?.tab?.capo ?? 0
  const beat = chord && chord.bar === bar ? chord.beat : 1
  const mirrored = me.data?.handedness === 'left'
  const select = (id: string) =>
    onSelectNote
      ? onSelectNote(id)
      : usePracticeUi.setState({ editor: { kind: 'bar', bar, chordId: chord?.id, noteId: id } })

  return (
    <div className="flex flex-col gap-6" data-slot="editor">
      <p className="text-read-label font-semibold tabular-nums">
        {bar < 0
          ? m['practice.pickup']()
          : m['editor.position']({ bar: String(bar + 1), beat: String(beat) })}
      </p>

      {chord && segment && (
        <section aria-labelledby="editor-chords" className="flex flex-col gap-3">
          <h3 id="editor-chords" className="text-lg">
            {m['editor.chord']()}
          </h3>
          {chords.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {chords.map((c) => (
                <Button
                  key={c.id}
                  variant={c.id === chord.id ? 'secondary' : 'ghost'}
                  aria-pressed={c.id === chord.id}
                  onClick={() =>
                    usePracticeUi.setState({ editor: { kind: 'bar', bar, chordId: c.id } })
                  }
                >
                  {c.name}
                </Button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4">
            <p className="font-reading text-read-chord-current">{chord.name}</p>
            {data.instrument === 'guitar' && chordShapes(transposeChord(chord.label, -capo))[0] && (
              <ChordDiagram
                className="h-24 w-20 text-ink"
                mirrored={mirrored}
                frets={chordShapes(transposeChord(chord.label, -capo))[0]?.frets ?? []}
                label={m['editor.diagram']({ chord: chord.name })}
              />
            )}
          </div>
          {chord.alternatives.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{m['editor.alternatives']()}</p>
              <div className="flex flex-wrap gap-2">
                {chord.alternatives.slice(0, 4).map((alt, index) => (
                  <Button
                    key={alt.label}
                    size="practice-2"
                    variant="outline"
                    className="flex-col items-start gap-0 py-2"
                    onClick={() => edit(setChord(segment, alt.label))}
                  >
                    <span className="font-reading text-read-chord leading-none">{alt.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {index === 0
                        ? m['editor.second_guess']({ n: String(oneIn(alt.prob)) })
                        : m['editor.one_in']({ n: String(oneIn(alt.prob)) })}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          <TypeChord
            onChord={(parsed) => {
              const change = setChord(segment, parsed.label)
              if (parsed.bass && change.op.op === 'set_chord') change.op.bass = parsed.bass
              edit(change)
            }}
            onSplit={(parsed) => {
              const at = grid.beatsOf(bar)[Math.max(0, beat - 1)] ?? chord.t0
              const splitAt =
                at > segment.t0 && at < segment.t1 ? at : (segment.t0 + segment.t1) / 2
              edit(splitChord(segment, segments, splitAt, parsed.label))
            }}
          />
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => edit(reportWrong('chords', segment.id))}
          >
            <FlagIcon aria-hidden />
            {m['editor.report_wrong']()}
          </Button>
        </section>
      )}

      {notes.length > 0 && (
        <section aria-labelledby="editor-notes" className="flex flex-col gap-3">
          <h3 id="editor-notes" className="text-lg">
            {m['editor.notes']()}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {notes.map((n) => (
              <li key={n.id}>
                <Button
                  size="practice-2"
                  variant={n.id === note?.id ? 'secondary' : 'outline'}
                  aria-pressed={n.id === note?.id}
                  className={cn(n.confidence !== 'high' && 'border-dashed')}
                  onClick={() => select(n.id)}
                >
                  <span className="tabular-nums">
                    {m['editor.note_label']({
                      note: noteName(n.pitch),
                      string: String(n.string ?? '–'),
                      fret: String(n.fret ?? '–'),
                    })}
                  </span>
                  {n.confidence === 'low' && <span aria-hidden>?</span>}
                </Button>
              </li>
            ))}
          </ul>
          {note && effectiveNote && note.string !== undefined && note.fret !== undefined && (
            <div className="flex flex-wrap items-end gap-4">
              <Stepper
                label={m['editor.string']()}
                down={m['editor.string_down']()}
                up={m['editor.string_up']()}
                value={note.string}
                min={1}
                max={tuning.length}
                onChange={(string) => {
                  const fret = note.pitch - (tuning[string - 1] ?? 0)
                  const change = placeNote(
                    effectiveNote,
                    { string: note.string as number, fret: note.fret as number },
                    { string, fret },
                    tuning,
                  )
                  if (change) edit(change)
                }}
              />
              <Stepper
                label={m['editor.fret']()}
                down={m['editor.fret_down']()}
                up={m['editor.fret_up']()}
                value={note.fret}
                min={0}
                max={24}
                onChange={(fret) => {
                  const change = placeNote(
                    effectiveNote,
                    { string: note.string as number, fret: note.fret as number },
                    { string: note.string as number, fret },
                    tuning,
                  )
                  if (change) edit(change)
                }}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{m['editor.length']()}</span>
                <div className="flex gap-2">
                  {([-1, 1] as const).map((direction) => (
                    <Button
                      key={direction}
                      variant="outline"
                      onClick={() => {
                        const tick =
                          timeToTick(grid.grid, effectiveNote.offset_s) + (direction * PPQ) / 4
                        const change = setNoteEnd(effectiveNote, tickToTime(grid.grid, tick))
                        if (change) edit(change)
                      }}
                    >
                      {direction === -1 ? m['editor.shorter']() : m['editor.longer']()}
                    </Button>
                  ))}
                </div>
              </div>
              <Button variant="destructive" onClick={() => edit(deleteNote(effectiveNote))}>
                <Trash2Icon aria-hidden />
                {m['editor.delete_note']()}
              </Button>
              <Button variant="ghost" onClick={() => edit(reportWrong('notes', note.id))}>
                <FlagIcon aria-hidden />
                {m['editor.report_wrong']()}
              </Button>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => practice.hearBar(bar)}>
          <HeadphonesIcon aria-hidden />
          {m['editor.hear_bar']()}
        </Button>
        {notes.length > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              practice.send({ type: 'PAUSE' })
              const start = grid.barStart(bar)
              void playTabPreview(
                notes.map((n) => ({
                  at: n.onset - start,
                  duration: n.offset - n.onset,
                  midi: n.pitch,
                })),
                player.speedPct / 100,
              )
            }}
          >
            <MusicIcon aria-hidden />
            {m['editor.hear_tab']()}
          </Button>
        )}
      </div>

      <section aria-labelledby="editor-beat" className="flex flex-col gap-2">
        <h3 id="editor-beat" className="text-base font-medium">
          {m['practice.beat_off']()}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => edit(beatFix('half'))}>
            {m['practice.half_tempo']()}
          </Button>
          <Button variant="outline" onClick={() => edit(beatFix('double'))}>
            {m['practice.double_tempo']()}
          </Button>
          <Button variant="outline" onClick={() => edit(beatFix('shift'))}>
            {m['practice.move_downbeat']()}
          </Button>
        </div>
      </section>
    </div>
  )
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
    <div className="flex flex-col gap-1.5">
      <span aria-hidden className="text-sm font-medium">
        {label}
      </span>
      <NumberField
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

function TypeChord({
  onChord,
  onSplit,
}: {
  onChord: (chord: { label: string; bass?: string }) => void
  onSplit: (chord: { label: string; bass?: string }) => void
}) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const id = useId()
  const errorId = useId()
  const parsed = parseChordInput(text)
  const submit = (then: (chord: { label: string; bass?: string }) => void) => {
    if (!parsed) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    then(parsed)
    setText('')
  }
  return (
    <form
      className="flex flex-col gap-2"
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
          placeholder={m['editor.type_chord_hint']()}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => setInvalid(text.trim() !== '' && !parsed)}
          className="w-40"
        />
        <Button type="submit" variant="outline">
          {m['editor.use_chord']()}
        </Button>
        <Button type="button" variant="ghost" onClick={() => submit(onSplit)}>
          <ScissorsIcon aria-hidden />
          {m['editor.split']()}
        </Button>
      </div>
      {invalid && (
        <p id={errorId} className="text-sm text-destructive">
          {m['editor.chord_invalid']()}
        </p>
      )}
    </form>
  )
}
