import { m } from '@/lib/i18n'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Kbd } from '@/ui/kbd'
import { KeyBindings } from './key-bindings'
import { usePracticeUi } from './practice-store'

// The `?` shortcuts overlay (27 §3.7.2 desktop): the practice key map plus the editor keys.
export function ShortcutsOverlay() {
  const open = usePracticeUi((s) => s.shortcutsOpen)
  return (
    <Dialog open={open} onOpenChange={(next) => usePracticeUi.setState({ shortcutsOpen: next })}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{m['practice.shortcuts']()}</DialogTitle>
          <DialogDescription>{m['shortcuts.description']()}</DialogDescription>
        </DialogHeader>
        <KeyBindings />
        <ul className="flex flex-col gap-2 text-base">
          <li>
            <Kbd>{m['shortcuts.key_edit']()}</Kbd> {m['shortcuts.edit_bar']()}
          </li>
          <li>
            <Kbd>?</Kbd> {m['shortcuts.this_list']()}
          </li>
          <li>
            <Kbd>{m['shortcuts.key_undo_mac']()}</Kbd> / <Kbd>{m['shortcuts.key_undo']()}</Kbd>{' '}
            {m['shortcuts.undo']()}
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
