import { m } from '@/lib/i18n'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog'
import { Kbd } from '@/ui/kbd'
import { KeyBindings } from './key-bindings'
import { usePracticeUi } from './practice-store'

// The `?` shortcuts overlay (27 §3.7.4, desktop): the practice key map in 12 §8's order with "Learn
// key" per row, then the chords: the command palette (works with single keys off), this list and
// undo.
export function ShortcutsOverlay() {
  const open = usePracticeUi((s) => s.shortcutsOpen)
  return (
    <Dialog open={open} onOpenChange={(next) => usePracticeUi.setState({ shortcutsOpen: next })}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{m['practice.shortcuts']()}</DialogTitle>
          <DialogDescription>{m['shortcuts.description']()}</DialogDescription>
        </DialogHeader>
        <KeyBindings />
        <ul className="flex flex-col gap-2 text-base">
          <li>
            <Kbd>{m['nav.palette_key_mac']()}</Kbd> / <Kbd>{m['nav.palette_key']()}</Kbd>{' '}
            {m['shortcuts.palette']()}
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
