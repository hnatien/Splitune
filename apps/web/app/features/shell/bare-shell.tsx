import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { Wordmark } from '@/ui/brand'
import { SystemBanners } from '../system/system-banners'
import { SkipLink } from './skip-link'

// Bare shell (27 §1): auth landing, mock checkout and system pages. Wordmark only, one centred
// column of at most 480 px.
export function BareShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col">
      <SkipLink />
      <SystemBanners />
      <header className="flex min-h-16 items-center justify-center px-4">
        <Link
          to="/"
          aria-label={m['nav.home']()}
          className="inline-flex min-h-target items-center rounded-md"
        >
          <Wordmark />
        </Link>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-bare flex-1 flex-col gap-6 px-4 py-8"
      >
        {children}
      </main>
    </div>
  )
}
