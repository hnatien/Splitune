import { m } from '@/lib/i18n'
import { EditorContent } from './editor-content'
import { unsureSpots } from './model/view-model'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// The Fix tab (27 §3.7.4; s38 builds Fix mode and the queue): today's editor for the bar chosen by
// tapping a chord, a "?", E (the bar playing) or J / K (the next or previous unsure bar). With no
// bar chosen it says how to pick one, or that nothing is marked unsure.
export function FixTab() {
  const editor = usePracticeUi((s) => s.editor)
  const { view } = usePractice()
  if (!editor) {
    return (
      <p className="text-md text-muted-foreground">
        {unsureSpots(view).count > 0 ? m['practice.fix_select']() : m['practice.fix_empty']()}
      </p>
    )
  }
  return <EditorContent bar={editor.bar} chordId={editor.chordId} noteId={editor.noteId} />
}
