import { Link } from '@tanstack/react-router'
import { LibraryIcon, PlusIcon, SettingsIcon } from 'lucide-react'
import { m } from '@/lib/i18n'

// A tab: the icon over its name, muted at rest; the current page is the ink with a 2 px ink line
// along the bar's top edge (a border, so forced colours keep it), never a fill.
const TAB =
  'relative flex min-h-target flex-col items-center justify-center gap-0.5 rounded-field text-caption text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:before:absolute aria-[current=page]:before:inset-x-6 aria-[current=page]:before:-top-1.5 aria-[current=page]:before:border-t-2 aria-[current=page]:before:border-selected focus-visible:-outline-offset-2 [&_svg]:size-5 [&_.lucide]:stroke-[1.8]'

const isUnder = (pathname: string, section: string) =>
  pathname === section || pathname.startsWith(`${section}/`)

// Bottom bar below 1024 px (s47 direction §6): Library · Add song · Settings, 56 px plus the safe
// area, a hairline above it. Add song is a tab like the others, so each page keeps its own one
// primary; Usage sits in the top bar.
export function BottomNav({ pathname, onAddSong }: { pathname: string; onAddSong: () => void }) {
  return (
    <nav
      data-slot="bottom-tabs"
      aria-label={m['nav.main']()}
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) grid grid-cols-3 items-center border-t border-border bg-background px-2 pt-1.5 pb-[calc(var(--spacing)*1.5+env(safe-area-inset-bottom))] lg:hidden"
    >
      <Link
        to="/library"
        aria-current={isUnder(pathname, '/library') ? 'page' : undefined}
        className={TAB}
      >
        <LibraryIcon aria-hidden />
        {m['nav.library']()}
      </Link>
      <button type="button" onClick={onAddSong} className={TAB}>
        <PlusIcon aria-hidden />
        {m['nav.add_song']()}
      </button>
      <Link
        to="/settings"
        aria-current={isUnder(pathname, '/settings') ? 'page' : undefined}
        className={TAB}
      >
        <SettingsIcon aria-hidden />
        {m['nav.settings']()}
      </Link>
    </nav>
  )
}
