import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { Wordmark } from '@/ui/brand'
import { SkipLink } from '../shell/skip-link'
import { SystemBanners } from '../system/system-banners'

// Auth shell (27 §1, §3.4): a nearly empty page, the wordmark top left and one centred form column
// of at most 400 px. No card around the form and no panel beside it, on every screen size.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <SystemBanners />
      <header className="flex min-h-16 items-center px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label={m['nav.home']()}
          className="inline-flex min-h-target items-center rounded-md"
        >
          <Wordmark />
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col px-4">
        <div className="mx-auto flex w-full max-w-form flex-1 flex-col">{children}</div>
      </main>
    </div>
  )
}
