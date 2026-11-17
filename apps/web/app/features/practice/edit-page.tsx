import { useNavigate } from '@tanstack/react-router'
import { HeadphonesIcon, Redo2Icon } from 'lucide-react'
import { useEffect } from 'react'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { Button } from '@/ui/button'
import { FocusShell } from '../shell/focus-shell'
import { FixDock, FixKey, FixMode, FixPill, stepSelection, useFixQueue } from './fix-mode'
import { useFix } from './fix-store'
import { FixTab } from './fix-tab'
import { useCorrections } from './model/corrections'
import { deleteNote } from './model/edits'
import { ignoredTarget } from './model/keymap'
import { NotationPane } from './notation-pane'
import { type FetchAudio, PracticeProvider, usePractice } from './practice-context'
import { PracticeLoading } from './practice-loading'
import { usePracticeUi } from './practice-store'

// Edit (27 §3.8): the full editor, reached from Fix → "Open full editor". Fix mode on a page of
// its own: the notation, wide, and an inspector built from the Fix components (the spot header,
// the chord and note cards, the beat fixes, Your edits with Revert), with undo / redo and Hear
// original in the top bar and the Fix dock below. Keyboard-first: J / K step through the unsure
// spots, ← / → select the previous / next note, Delete removes the selected note, Space plays the
// selected bars, ⌘/Ctrl Z undoes. Touch devices go to Practice in Fix mode.

export function EditPage({ songId, fetchAudio }: { songId: string; fetchAudio?: FetchAudio }) {
  const coarse = useMediaQuery('(pointer: coarse)', false)
  const navigate = useNavigate()
  useEffect(() => {
    if (!coarse) return
    void navigate({
      to: '/songs/$songId/practice',
      params: { songId },
      search: { tab: 'fix' },
      replace: true,
    })
  }, [coarse, navigate, songId])
  return (
    <PracticeProvider
      songId={songId}
      search={{ tab: 'fix' }}
      {...(fetchAudio ? { fetchAudio } : {})}
    >
      <EditScreen />
    </PracticeProvider>
  )
}

function EditScreen() {
  const practice = usePractice()
  const { view, data, songId } = practice
  const navigate = useNavigate()
  const target = usePracticeUi((s) => s.editor)
  const redoCount = useCorrections((s) => s.redo.length)
  const { queue, spot } = useFixQueue()
  const done = () => void navigate({ to: '/songs/$songId/practice', params: { songId } })

  const selectNote = (noteId: string) => {
    const note = view?.notes.find((n) => n.id === noteId)
    if (note) usePracticeUi.setState({ editor: { kind: 'bar', bar: note.bar, noteId } })
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
      const key = event.key.toLowerCase()
      if (key === ' ') {
        event.preventDefault()
        practice.togglePlay()
        return
      }
      if (key === 'j' || key === 'k') {
        event.preventDefault()
        stepSelection(queue, spot, key === 'j' ? 1 : -1)
        useFix.setState({ focus: true })
        return
      }
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      const notes = [...(view?.notes ?? [])].sort((a, b) => a.onset - b.onset)
      if (step !== 0 && notes.length > 0) {
        event.preventDefault()
        const index = notes.findIndex((n) => n.id === target?.noteId)
        const next = notes[Math.min(notes.length - 1, Math.max(0, index + step))]
        if (next)
          usePracticeUi.setState({ editor: { kind: 'bar', bar: next.bar, noteId: next.id } })
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && target?.noteId) {
        const effective = practice.music?.tab?.notes.find((n) => n.id === target.noteId)
        if (!effective) return
        event.preventDefault()
        practice.edit(deleteNote(effective))
        usePracticeUi.setState({ editor: { ...target, noteId: undefined } })
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
          <span className="min-w-0 truncate text-button-lg font-medium">
            {data.song.data?.title}
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <FixPill onDone={done} />
          </div>
          <div
            className="flex shrink-0 items-center gap-1"
            role="toolbar"
            aria-label={m['edit.toolbar']()}
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label={m['editor.redo']()}
              disabled={redoCount === 0}
              onClick={() => practice.redo()}
            >
              <Redo2Icon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              disabled={!target}
              onClick={() => target && practice.hearBar(target.bar)}
            >
              <HeadphonesIcon aria-hidden />
              {m['fix.hear_original']()}
            </Button>
          </div>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_25rem]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <NotationPane
            interaction="notes"
            selectedNoteId={target?.noteId ?? null}
            onNoteActivate={selectNote}
            onBarActivate={(bar) => usePracticeUi.setState({ editor: { kind: 'bar', bar } })}
          />
          <FixKey />
        </div>
        <aside
          aria-label={m['edit.inspector']()}
          className="flex min-h-0 flex-col overflow-y-auto border-l border-border bg-card p-4.5"
        >
          <FixTab fullEditor={false} empty={m['edit.empty']()} />
        </aside>
      </div>
      <FixDock />
      <FixMode onLeave={done} />
    </FocusShell>
  )
}
