import type { Beats, Chords, Notes } from '@splitune/music-core'
import { useNavigate } from '@tanstack/react-router'
import { PencilRulerIcon, Redo2Icon, RotateCcwIcon, Undo2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { Button } from '@/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { FocusShell } from '../shell/focus-shell'
import { EditorContent } from './editor-content'
import { applyCorrection, useCorrections } from './model/corrections'
import { deleteNote, type Edit, revertOp } from './model/edits'
import { ignoredTarget } from './model/keymap'
import { NotationPane } from './notation-pane'
import { type FetchAudio, PracticeProvider, usePractice } from './practice-context'
import { PracticeLoading } from './practice-loading'
import { TransportBar } from './transport-bar'

// Edit (27 §3.8): desktop-first two panes — the notation, wide, and an inspector with the selected
// bar's or note's properties, its alternatives and the corrections history with a revert per op.
// Keyboard-first: ←/→ select the previous/next note (or bar), Delete removes a note, ⌘/Ctrl Z
// undoes. Touch devices go to practice, where the editor is a sheet.

export function EditPage({ songId, fetchAudio }: { songId: string; fetchAudio?: FetchAudio }) {
  const coarse = useMediaQuery('(pointer: coarse)', false)
  const navigate = useNavigate()
  useEffect(() => {
    if (coarse) void navigate({ to: '/songs/$songId/practice', params: { songId }, replace: true })
  }, [coarse, navigate, songId])
  return (
    <PracticeProvider songId={songId} search={{}} {...(fetchAudio ? { fetchAudio } : {})}>
      <EditScreen />
    </PracticeProvider>
  )
}

function EditScreen() {
  const practice = usePractice()
  const { view, grid, data } = practice
  const [mode, setMode] = useState<'notes' | 'bars'>('notes')
  const [bar, setBar] = useState<number | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const undoCount = useCorrections((s) => s.undo.length)
  const redoCount = useCorrections((s) => s.redo.length)
  const notes = [...(view?.notes ?? [])].sort((a, b) => a.onset - b.onset)

  const selectNote = (id: string) => {
    const note = notes.find((n) => n.id === id)
    setNoteId(id)
    if (note) setBar(note.bar)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (ignoredTarget({ ...event, metaKey: false, ctrlKey: false, key: 'z' })) return
        event.preventDefault()
        if (event.shiftKey) practice.redo()
        else practice.undo()
        return
      }
      if (ignoredTarget(event)) return
      if (event.key === ' ') {
        event.preventDefault()
        practice.togglePlay()
        return
      }
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        if (mode === 'notes' && notes.length > 0) {
          const index = notes.findIndex((n) => n.id === noteId)
          const next = notes[Math.min(notes.length - 1, Math.max(0, index + step))]
          if (next) selectNote(next.id)
        } else if (grid) {
          setBar((current) =>
            Math.min(
              grid.lastBar,
              Math.max(grid.firstBar, (current ?? grid.firstBar - step) + step),
            ),
          )
        }
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && noteId) {
        const effective = practice.music?.tab?.notes.find((n) => n.id === noteId)
        if (!effective) return
        event.preventDefault()
        practice.edit(deleteNote(effective))
        setNoteId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (data.song.isPending) return <PracticeLoading />
  return (
    <FocusShell
      fill
      status={
        <>
          <span className="min-w-0 truncate text-base font-semibold">{data.song.data?.title}</span>
          <div
            className="ml-auto flex items-center gap-2"
            role="toolbar"
            aria-label={m['edit.toolbar']()}
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label={m['editor.undo']()}
              disabled={undoCount === 0}
              onClick={() => practice.undo()}
            >
              <Undo2Icon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={m['editor.redo']()}
              disabled={redoCount === 0}
              onClick={() => practice.redo()}
            >
              <Redo2Icon aria-hidden />
            </Button>
            <ToggleGroup
              aria-label={m['edit.select']()}
              value={[mode]}
              onValueChange={(next) => next[0] && setMode(next[0] as 'notes' | 'bars')}
            >
              <ToggleGroupItem value="notes">{m['edit.select_notes']()}</ToggleGroupItem>
              <ToggleGroupItem value="bars">{m['edit.select_bars']()}</ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant="outline"
              disabled={bar === null}
              onClick={() => bar !== null && practice.hearBar(bar)}
            >
              {m['editor.hear_bar']()}
            </Button>
          </div>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_25rem]">
        <NotationPane
          interaction={mode}
          selectedNoteId={noteId}
          onNoteActivate={selectNote}
          onBarActivate={(next) => {
            setBar(next)
            setNoteId(null)
          }}
        />
        <aside
          aria-label={m['edit.inspector']()}
          className="flex min-h-0 flex-col gap-6 overflow-y-auto border-l border-border px-4 py-4"
        >
          {bar === null ? (
            <p className="flex items-center gap-3 text-base text-muted-foreground">
              <PencilRulerIcon aria-hidden className="size-6 shrink-0" />
              {m['edit.empty']()}
            </p>
          ) : (
            <EditorContent bar={bar} noteId={noteId ?? undefined} onSelectNote={selectNote} />
          )}
          <History />
        </aside>
      </div>
      <TransportBar layout="desktop" />
    </FocusShell>
  )
}

const OP_LABEL: Record<string, () => string> = {
  set_chord: () => m['history.set_chord'](),
  split_chord: () => m['history.split_chord'](),
  set_note: () => m['history.set_note'](),
  add_note: () => m['history.add_note'](),
  delete_note: () => m['history.delete_note'](),
  shift_downbeat: () => m['history.shift_downbeat'](),
  tempo_octave: () => m['history.tempo_octave'](),
  nudge_beat: () => m['history.nudge_beat'](),
  report_wrong: () => m['history.report_wrong'](),
  mark_correct: () => m['history.mark_correct'](),
  set_section: () => m['history.set_section'](),
}

// Corrections history (27 §3.8): every op on this song's artefacts, newest first, each with a
// revert that appends its inverse (the overlay is append-only).
function History() {
  const { data, artefactFor } = usePractice()
  const groups: { kind: Edit['kind']; base: Chords | Notes | Beats | undefined }[] = [
    { kind: 'chords', base: data.chords.data },
    // Drum hits have no edits yet (step 25), so only pitched notes have a history.
    {
      kind: 'notes',
      base: data.notes.data && 'notes' in data.notes.data ? data.notes.data : undefined,
    },
    { kind: 'beats', base: data.beats.data },
  ]
  const rows = groups.flatMap(({ kind, base }) =>
    data.ops[kind].ops.map((op, index) => ({ kind, base, op, index })),
  )
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="history" className="flex flex-col gap-2">
      <h3 id="history" className="text-lg">
        {m['edit.history']()}
      </h3>
      <ol className="flex flex-col divide-y divide-border">
        {rows.reverse().map(({ kind, base, op, index }) => {
          const inverse = base ? revertOp(kind, base, data.ops[kind].ops, index) : null
          const target = artefactFor(kind)
          return (
            <li key={`${kind}-${index}`} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-sm">{OP_LABEL[op.op]?.() ?? op.op}</span>
              {inverse && target && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => applyCorrection(target.id, inverse, op)}
                >
                  <RotateCcwIcon aria-hidden />
                  {m['edit.revert']()}
                </Button>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
