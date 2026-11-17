import { ChordCard, NoteCard, type Select, type Selection } from './fix-cards'
import { usePracticeUi } from './practice-store'

// The cards for a selection (27 §3.7.4): its chord and its notes, in the Fix tab, the tablet's
// editor sheet and the desktop editor alike. Choosing another chord or note of the selection keeps
// the bars.
export function EditorContent({ bar, endBar, chordId, noteId }: Selection) {
  const select: Select = (patch) =>
    usePracticeUi.setState({
      editor: { kind: 'bar', bar, endBar, chordId, noteId, ...patch },
    })
  return (
    <div className="flex flex-col gap-3.5" data-slot="editor">
      <ChordCard bar={bar} endBar={endBar} chordId={chordId} onSelect={select} />
      <NoteCard bar={bar} endBar={endBar} noteId={noteId} onSelect={select} />
    </div>
  )
}
