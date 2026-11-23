import { ChordCard, NoteCard, type Select, type Selection } from './fix-cards'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The sections for a selection (27 §3.7.4): its chord and its notes, in the Fix tab, the touch
// editor sheet and the full editor alike. The one the selection is about comes first and holds
// the suggested fix (Y): a chosen note, else a chosen chord, else the bar's notes. Choosing another
// chord or note of the selection keeps the bars.
export function EditorContent({ bar, endBar, chordId, noteId }: Selection) {
  const { view } = usePractice()
  const select: Select = (patch) =>
    usePracticeUi.setState({
      editor: { kind: 'bar', bar, endBar, chordId, noteId, ...patch },
    })
  const last = endBar ?? bar
  const hasNotes = view?.notes.some((n) => n.bar >= bar && n.bar <= last) ?? false
  const about = noteId ? 'note' : chordId || !hasNotes ? 'chord' : 'note'
  const chord = (
    <ChordCard
      key="chord"
      bar={bar}
      endBar={endBar}
      chordId={chordId}
      onSelect={select}
      active={about === 'chord'}
    />
  )
  const notes = (
    <NoteCard
      key="note"
      bar={bar}
      endBar={endBar}
      noteId={noteId}
      onSelect={select}
      active={about === 'note'}
    />
  )
  return (
    <div className="flex flex-col border-t border-border" data-slot="editor" data-about={about}>
      {about === 'chord' ? [chord, notes] : [notes, chord]}
    </div>
  )
}
