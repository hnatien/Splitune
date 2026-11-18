import { Link } from '@tanstack/react-router'
import { GaugeIcon, LayoutGridIcon, PlusIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { Button } from '@/ui/button'
import { UsagePopover } from './usage-popover'

const TAB =
  'flex min-h-target min-w-target flex-col items-center justify-center gap-0.5 rounded-lg text-xs text-faint-foreground aria-[current=page]:text-foreground data-popup-open:text-foreground focus-visible:-outline-offset-2 [&_svg]:size-5 [&_.lucide]:stroke-[1.8]'

// Phone bottom bar (27 §1, 26 §12.2 BottomNav, Phone-Library): Library · Add song (a 48 px primary
// pill) · Usage (the allowances and plan in a popover above it), 76 px plus the safe area. Hidden from `sm`, where the top bar has them.
export function BottomNav({
  me,
  pathname,
  onAddSong,
}: {
  me: MeData
  pathname: string
  onAddSong: () => void
}) {
  const library = pathname === '/library' || pathname.startsWith('/library/')
  return (
    <nav
      data-slot="bottom-tabs"
      aria-label={m['nav.main']()}
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) grid h-[calc(var(--spacing)*19+env(safe-area-inset-bottom))] grid-cols-3 items-center border-t border-border bg-background px-3 pb-[calc(var(--spacing)*2.5+env(safe-area-inset-bottom))] sm:hidden"
    >
      <Link to="/library" aria-current={library ? 'page' : undefined} className={TAB}>
        <LayoutGridIcon aria-hidden />
        {m['nav.library']()}
      </Link>
      <Button variant="primary" size="lg" onClick={onAddSong} className="justify-self-center px-5">
        <PlusIcon aria-hidden className="size-4" />
        {m['nav.add_song']()}
      </Button>
      <UsagePopover
        me={me}
        side="top"
        trigger={
          <button type="button" className={TAB}>
            <GaugeIcon aria-hidden />
            {m['nav.usage']()}
          </button>
        }
      />
    </nav>
  )
}
