import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { Wordmark } from '@/ui/brand'
import { buttonVariants } from '@/ui/button'
import { SkipLink } from '../shell/skip-link'
import { SystemBanners } from '../system/system-banners'

// Auth shell (27 §1, §3.4): a nearly empty page on the marketing grid. The wordmark top left and a
// quiet way to the example song top right, for whoever arrived here by mistake; then one centred
// form column of at most 400 px, with no card around it and no panel beside it.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <header className="mx-auto flex min-h-16 w-full max-w-page items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label={m['nav.home']()}
          className="inline-flex min-h-target items-center rounded-media"
        >
          <Wordmark />
        </Link>
        <Link to="/start" className={buttonVariants({ variant: 'quiet', size: 'sm' })}>
          {m['home.cta_example']()}
        </Link>
      </header>
      <SystemBanners />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col px-4">
        <div className="mx-auto flex w-full max-w-form flex-1 flex-col">{children}</div>
      </main>
    </div>
  )
}
