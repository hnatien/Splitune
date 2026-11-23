import { m } from '@/lib/i18n'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { EditorContent } from './editor-content'
import { BeatFixes } from './fix-cards'
import { EditHistory } from './fix-history'
import { usePracticeUi } from './practice-store'

// EditorSheet (27 §3.7.2; tablets and phones until s43): the Fix cards for the bar chosen by
// tapping a chord or pressing E, in a bottom sheet on touch and a 400 px side panel on a landscape
// tablet. Fix mode itself (the queue, the looped bars, Listen to) belongs to layouts with an
// inspector.
export function EditorSheet({ side }: { side: boolean }) {
  const editor = usePracticeUi((s) => s.editor)
  return (
    <Drawer
      open={editor !== null}
      onOpenChange={(open) =>
        !open && usePracticeUi.setState({ editor: null, showOriginal: false })
      }
      swipeDirection={side ? 'right' : 'down'}
      modal={!side}
    >
      <DrawerContent
        data-practice-keys=""
        className={side ? 'data-[swipe-axis=x]:sm:[--drawer-content-width:25rem]' : ''}
      >
        <DrawerHeader>
          <DrawerTitle>{m['editor.title']()}</DrawerTitle>
          <DrawerDescription className="sr-only">{m['editor.description']()}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3.5 overflow-y-auto px-4 pb-6">
          {editor && (
            <>
              <EditorContent
                bar={editor.bar}
                endBar={editor.endBar}
                chordId={editor.chordId}
                noteId={editor.noteId}
              />
              <BeatFixes />
              <EditHistory />
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
