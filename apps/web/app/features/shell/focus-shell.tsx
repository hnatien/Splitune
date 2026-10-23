import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { UploadPill } from '../import/upload-pill'
import { SystemBanners } from '../system/system-banners'
import { SkipLink } from './skip-link'

// Focus shell (27 §1): onboarding and practice. A slim status bar with "Back to library" and the
// page's own status; no navigation chrome. Practice density (64/48 px targets).
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
      <header className="sticky top-0 z-(--z-sticky) border-b border-border bg-background pt-[env(safe-area-inset-top)] [view-transition-name:app-header]">
        <div className="flex min-h-14 items-center gap-3 px-4 in-data-[appearance=stage]:min-h-12">
          <Link
            to={exit ? '/' : '/library'}
            className={buttonVariants({ variant: 'ghost', className: 'max-sm:min-w-target' })}
          >
            <ChevronLeftIcon aria-hidden />
            {/* Icon only on phones, so the page's status keeps its room. */}
            <span className="max-sm:sr-only">
              {exit ? m['nav.exit']() : m['nav.back_to_library']()}
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-3">{status}</div>
          <UploadPill />
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
    </div>
  )
}
