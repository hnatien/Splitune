import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon, SearchIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { UploadPill } from '../import/upload-pill'
import { SystemBanners } from '../system/system-banners'
import { PaletteLauncher } from './palette-launcher'
import { usePalette } from './palette-store'
import { SkipLink } from './skip-link'

// Focus shell (27 §1): onboarding and practice. A quiet top bar (52 px, 48 on phones) with
// "‹ Library" and the page's own status; no navigation chrome and no rule under the bar, so the
// page's content starts the structure. Practice density (48 px targets, 64 for Play). Signed in,
// ⌘K / Ctrl K opens the palette, and touch screens get its button (27 §3.12).
export function FocusShell({
  status,
  exit = false,
  fill = false,
  children,
}: {
  status?: React.ReactNode
  /** Signed-out pages (onboarding) leave to Home with "Exit" instead of the library. */
  exit?: boolean
  /** Exactly the viewport (practice): regions size themselves and the transport never moves. */
  fill?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      data-density="practice"
      className={fill ? 'flex h-dvh flex-col overflow-hidden' : 'flex min-h-dvh flex-col'}
    >
      <SkipLink />
      <header className="sticky top-0 z-(--z-sticky) bg-background pt-[env(safe-area-inset-top)] [view-transition-name:app-header]">
        <div className="flex min-h-13 items-center gap-2 px-2 max-sm:min-h-12 sm:px-3">
          <Link
            to={exit ? '/' : '/library'}
            className={buttonVariants({
              variant: 'quiet',
              size: 'sm',
              className: 'shrink-0 max-sm:min-w-target max-sm:px-0',
            })}
          >
            <ChevronLeftIcon aria-hidden />
            {/* Icon only on phones, so the page's status keeps its room. */}
            <span className="max-sm:sr-only">
              {exit ? m['nav.exit']() : m['nav.back_to_library']()}
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">{status}</div>
          <UploadPill />
          {!exit && (
            <Button
              variant="quiet"
              size="icon"
              aria-label={m['nav.search']()}
              onClick={() => usePalette.getState().setOpen(true)}
              // Practice on a phone keeps the bar for the view tabs: search is in its ⋯ menu.
              className={fill ? 'pointer-fine:hidden max-sm:hidden' : 'pointer-fine:hidden'}
            >
              <SearchIcon aria-hidden />
            </Button>
          )}
        </div>
      </header>
      <SystemBanners />
      <main
        id="main"
        tabIndex={-1}
        className={
          fill
            ? 'flex min-h-0 flex-1 flex-col'
            : 'flex flex-1 flex-col pb-[env(safe-area-inset-bottom)]'
        }
      >
        {children}
      </main>
      {!exit && <PaletteLauncher />}
    </div>
  )
}
