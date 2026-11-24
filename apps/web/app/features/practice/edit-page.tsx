import { useNavigate } from '@tanstack/react-router'
import { HeadphonesIcon } from 'lucide-react'
import { useEffect } from 'react'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { Button } from '@/ui/button'
import { Panel } from '@/ui/panel'
import { FocusShell } from '../shell/focus-shell'
import { FixDock, FixKey, FixMode, FixPill, stepSelection, useFixQueue } from './fix-mode'
import { useFix } from './fix-store'
import { FixTab } from './fix-tab'
import { useKeys } from './keys-store'
import { deleteNote } from './model/edits'
import { ignoredTarget, resolveKey } from './model/keymap'
import { NotationPane } from './notation-pane'
import { type FetchAudio, PracticeProvider, usePractice } from './practice-context'
import { PracticeLoading } from './practice-loading'
import { showHud, usePracticeUi } from './practice-store'

// Edit (27 §3.8; s47 direction §7): the full editor, reached from Fix → "Open full editor". Fix
// mode on a page of its own: the notation, wide, and the one panel built from the Fix sections
// (the spot header, the chord and note sections, the beat fixes, Your edits with Revert), with the
// Fixing line, Undo / Redo and Done in the top bar beside Hear original, the key line under the
// notation and the Fix dock below. Below 1024 px the panel sits under the notation instead of
// beside it. Keyboard-first, with the practice key map and this device's learned pedal keys: J / K
// and the pedal step through the unsure spots, Y accepts the suggested fix, ← / → select the
// previous / next note, Delete removes it, Space plays the selected bars, `,` / `.` change the fix
// speed, ⌘/Ctrl Z undoes and Shift redoes. Esc first lets go of the selected note, then leaves.
// Touch devices go to Practice, where the editor sheet does the same.

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
  const { queue, spot } = useFixQueue()
  const done = () => void navigate({ to: '/songs/$songId/practice', params: { songId } })
  // Esc lets go of the selected note before it leaves the page.
  const leave = () => {
    const now = usePracticeUi.getState().editor
    if (now?.noteId) usePracticeUi.setState({ editor: { ...now, noteId: undefined } })
    else done()
  }

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
      if ((event.key === 'Delete' || event.key === 'Backspace') && target?.noteId) {
        const effective = practice.music?.tab?.notes.find((n) => n.id === target.noteId)
        if (!effective) return
        event.preventDefault()
        practice.edit(deleteNote(effective))
        usePracticeUi.setState({ editor: { ...target, noteId: undefined } })
        return
      }
      // ← / → move between notes here (the transport's bar steps have no meaning in the editor).
      const step =
        event.key === 'ArrowRight' && !event.shiftKey
          ? 1
          : event.key === 'ArrowLeft' && !event.shiftKey
            ? -1
            : 0
      const notes = [...(view?.notes ?? [])].sort((a, b) => a.onset - b.onset)
      if (step !== 0 && notes.length > 0) {
        event.preventDefault()
        const index = notes.findIndex((n) => n.id === target?.noteId)
        const next = notes[Math.min(notes.length - 1, Math.max(0, index + step))]
        if (next) {
          usePracticeUi.setState({ editor: { kind: 'bar', bar: next.bar, noteId: next.id } })
        }
        return
      }
      const keys = useKeys.getState()
      const result = resolveKey(event, keys.learned, keys.singleKeys)
      if (result.kind !== 'action') return
      switch (result.action) {
        case 'playPause':
          event.preventDefault()
          practice.togglePlay()
          return
        case 'nextUnsure':
        case 'previousUnsure':
        case 'pedalRight':
        case 'pedalLeft': {
          event.preventDefault()
          const forward = result.action === 'nextUnsure' || result.action === 'pedalRight'
          stepSelection(queue, spot, forward ? 1 : -1)
          useFix.setState({ focus: true })
          return
        }
        case 'slower':
        case 'faster':
          event.preventDefault()
          practice.setSpeed(
            practice.player.speedPct +
              (result.action === 'faster' ? 1 : -1) * (result.fine ? 1 : 5),
          )
          return
        case 'acceptFix': {
          event.preventDefault()
          // The spot's own suggested-fix control does it, so the key and the button are one path.
          const primary = document.querySelector<HTMLElement>('[data-fix-primary]')
          if (primary) primary.click()
          else showHud(m['practice.hud_no_fix']())
          return
        }
        default:
          return
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
          <span className="min-w-0 truncate text-title">{data.song.data?.title}</span>
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <FixPill onDone={done} />
          </div>
          <div
            className="flex shrink-0 items-center gap-1"
            role="toolbar"
            aria-label={m['edit.toolbar']()}
          >
            <Button
              variant="quiet"
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
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <NotationPane
            interaction="notes"
            selectedNoteId={target?.noteId ?? null}
            onNoteActivate={selectNote}
            onBarActivate={(bar) => usePracticeUi.setState({ editor: { kind: 'bar', bar } })}
          />
          <FixKey editor />
        </div>
        <Panel
          aria-label={m['edit.inspector']()}
          className="w-100 max-lg:h-2/5 max-lg:w-full max-lg:border-t max-lg:border-l-0"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <FixTab fullEditor={false} empty={m['edit.empty']()} />
          </div>
        </Panel>
      </div>
      <FixDock />
      <FixMode onLeave={leave} />
    </FocusShell>
  )
}
