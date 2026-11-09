import { Link } from '@tanstack/react-router'
import { LayoutGridIcon, PlusIcon, SlidersHorizontalIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'

const TAB =
  'flex min-h-target min-w-target flex-col items-center justify-center gap-0.5 rounded-lg text-xs text-faint-foreground aria-[current=page]:text-foreground focus-visible:-outline-offset-2 [&_svg]:size-5 [&_.lucide]:stroke-[1.8]'

// Phone bottom bar (27 §1, 26 §12.2 BottomNav, Phone-Library): Library · Add song (a 48 px primary
// pill) · Settings, 76 px plus the safe area. Hidden from `sm`, where the top bar has them.
export function BottomNav({ pathname, onAddSong }: { pathname: string; onAddSong: () => void }) {
  const library = pathname === '/library' || pathname.startsWith('/library/')
  const settings = pathname === '/settings' || pathname.startsWith('/settings/')
  return (
    <nav
      data-slot="bottom-tabs"
      aria-label={m['nav.main']()}
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) grid h-[calc(var(--spacing)*19+env(safe-area-inset-bottom))] grid-cols-3 items-center border-t border-border bg-card px-3 pb-[calc(var(--spacing)*2.5+env(safe-area-inset-bottom))] sm:hidden"
    >
      <Link to="/library" aria-current={library ? 'page' : undefined} className={TAB}>
        <LayoutGridIcon aria-hidden />
        {m['nav.library']()}
      </Link>
      <Button
        variant="primary"
        size="lg"
        onClick={onAddSong}
        className="justify-self-center px-5 [--r:var(--radius-5xl)]"
      >
        <PlusIcon aria-hidden className="size-4" />
        {m['nav.add_song']()}
      </Button>
      <Link to="/settings/profile" aria-current={settings ? 'page' : undefined} className={TAB}>
        <SlidersHorizontalIcon aria-hidden />
        {m['nav.settings']()}
      </Link>
    </nav>
  )
}
