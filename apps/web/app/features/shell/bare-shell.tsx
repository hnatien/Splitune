import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { Wordmark } from '@/ui/brand'
import { SystemBanners } from '../system/system-banners'
import { SkipLink } from './skip-link'

// Bare shell (27 §1, 26 §7): mock checkout, the mock portal and the system pages. The wordmark and
// the system banners on the page's own grid (the marketing shell's), then one column of at most
// 480 px that reads from the top rather than floating in the middle of an empty viewport.
export function BareShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <header className="mx-auto flex min-h-16 w-full max-w-page items-center px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label={m['nav.home']()}
          className="inline-flex min-h-target items-center rounded-media"
        >
          <Wordmark />
        </Link>
      </header>
      <SystemBanners />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-bare flex-1 flex-col gap-6 px-4 pb-12"
      >
        {children}
      </main>
    </div>
  )
}
