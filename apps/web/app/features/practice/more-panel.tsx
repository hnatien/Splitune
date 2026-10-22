import { Link } from '@tanstack/react-router'
import { KeyboardIcon, PencilRulerIcon, SettingsIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { PopoverContent } from '@/ui/popover-content'
import { usePracticeUi } from './practice-store'

// The ⋯ popover (27 §3.7.1): the shortcuts overlay and the editor on desktop, key bindings.
export function MorePanel({ desktop, songId }: { desktop: boolean; songId: string }) {
  return (
    <PopoverContent align="end" className="w-64 gap-1 p-2">
      {desktop && (
        <>
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => usePracticeUi.setState({ shortcutsOpen: true })}
          >
            <KeyboardIcon aria-hidden />
            {m['practice.shortcuts']()}
          </Button>
          <Link
            to="/songs/$songId/edit"
            params={{ songId }}
            className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}
          >
            <PencilRulerIcon aria-hidden />
            {m['practice.open_editor']()}
          </Link>
        </>
      )}
      <Link
        to="/settings/keyboard"
        className={buttonVariants({ variant: 'ghost', className: 'justify-start' })}
      >
        <SettingsIcon aria-hidden />
        {m['nav.keyboard']()}
      </Link>
    </PopoverContent>
  )
}
