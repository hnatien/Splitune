import { XIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/ui/drawer'
import { PanelSection } from '@/ui/panel'
import { EditorContent } from './editor-content'
import { BeatFixes, barsLabel, SpotHeader } from './fix-cards'
import { EditHistory } from './fix-history'
import { stepSelection, useFixQueue } from './fix-mode'
import { usePracticeUi } from './practice-store'

// EditorSheet (27 §3.7.2; s47 direction §6): the Fix sections for the bar chosen by tapping a
// chord or a "?", or by E, J / K or the pedal, on touch layouts. On phones and upright tablets a
// sheet above the transport, at most 60 % of the height, so the bar being fixed stays in view
// over it; on a landscape tablet a 400 px side sheet. Neither is modal: the music stays playable
// and the keys and the pedal keep stepping through the unsure spots while it is open. The head
// says where the spot sits in the queue, with previous and next, and the sheet has a visible
// Close as well as its swipe.
const close = () => usePracticeUi.setState({ editor: null, showOriginal: false })

export function EditorSheet({ side }: { side: boolean }) {
  const editor = usePracticeUi((s) => s.editor)
  const showOriginal = usePracticeUi((s) => s.showOriginal)
  const { queue, spot, position } = useFixQueue()
  const bars = editor ? barsLabel(editor.bar, editor.endBar) : ''
  return (
    <Drawer
      open={editor !== null}
      onOpenChange={(open) => !open && close()}
      swipeDirection={side ? 'right' : 'down'}
      modal={false}
    >
      <DrawerContent
        data-practice-keys=""
        data-slot="editor-sheet"
        className={cn(
          side
            ? 'data-[swipe-axis=x]:top-13! data-[swipe-axis=x]:bottom-(--transport-height)! data-[swipe-axis=x]:[--drawer-content-width:25rem]'
            : 'bottom-(--transport-height)! [--drawer-height:min(60dvh,34rem)]',
        )}
      >
        <div className="flex shrink-0 items-center gap-2 pt-2 pr-2 pl-4">
          <DrawerTitle className="min-w-0 flex-1 truncate text-label text-muted-foreground">
            {m['editor.title']()}
          </DrawerTitle>
          <DrawerDescription className="sr-only">{m['editor.description']()}</DrawerDescription>
          <Button
            variant="quiet"
            size="icon-practice"
            aria-label={m['system.close']()}
            onClick={close}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-6">
          {editor && (
            <>
              <PanelSection className="pt-0 pb-4">
                <SpotHeader
                  title={
                    spot
                      ? m['fix.spot']({
                          n: String(position),
                          total: String(queue.length),
                          bars,
                        })
                      : editor.bar < 0 && !editor.endBar
                        ? m['practice.pickup']()
                        : m['fix.bar_one']({ bar: bars })
                  }
                  position={position}
                  total={queue.length}
                  onStep={(direction) => stepSelection(queue, spot, direction)}
                />
              </PanelSection>
              {!showOriginal && (
                <EditorContent
                  bar={editor.bar}
                  endBar={editor.endBar}
                  chordId={editor.chordId}
                  noteId={editor.noteId}
                />
              )}
              {!showOriginal && <BeatFixes />}
              <EditHistory />
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
