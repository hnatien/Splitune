import { m } from '@/lib/i18n'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { EditorContent } from './editor-content'
import { usePracticeUi } from './practice-store'

// EditorSheet (27 §3.7.4): a bottom sheet on touch, a 400 px right side panel on desktop
// (27 §3.7.2), opened by tapping a chord chip, "E" on a bar, or a note on /edit.
export function EditorSheet({ side }: { side: boolean }) {
  const editor = usePracticeUi((s) => s.editor)
  return (
    <Drawer
      open={editor !== null}
      onOpenChange={(open) => !open && usePracticeUi.setState({ editor: null })}
      swipeDirection={side ? 'right' : 'down'}
      modal={!side}
    >
      <DrawerContent
        className={side ? 'data-[swipe-axis=x]:sm:[--drawer-content-width:25rem]' : ''}
      >
        <DrawerHeader>
          <DrawerTitle>{m['editor.title']()}</DrawerTitle>
          <DrawerDescription className="sr-only">{m['editor.description']()}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          {editor && (
            <EditorContent bar={editor.bar} chordId={editor.chordId} noteId={editor.noteId} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
