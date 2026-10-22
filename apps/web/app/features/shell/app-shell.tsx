import { Link } from '@tanstack/react-router'
import { LibraryIcon, UploadIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { BrandMark, Wordmark } from '@/ui/brand'
import { buttonVariants } from '@/ui/button'
import { UploadPill } from '../import/upload-pill'
import { useClaimOnSignIn } from '../onboarding/claim-on-sign-in'
import { SystemBanners } from '../system/system-banners'
import { AccountMenu } from './account-menu'
import { SkipLink } from './skip-link'
import { UsageMeter } from './usage-meter'

// App shell (27 §1): 56 px bar with the wordmark (→ Library), Library, Import (the one primary
// action), the allowance meter from md up and the account menu. Library, import and settings.
export function AppShell({ me, children }: { me: MeData; children: React.ReactNode }) {
  useClaimOnSignIn()
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-(--z-sticky) border-b border-border bg-background">
        {/* Below sm the bar and its two buttons are tighter, so the account button fits at 320 px. */}
        <div className="mx-auto flex min-h-14 max-w-page items-center gap-2 px-3 sm:px-4 md:gap-4 md:px-6 lg:px-8">
          <Link
            to="/library"
            aria-label={m['nav.library_home']()}
            className="mr-auto inline-flex min-h-target min-w-target items-center rounded-md"
          >
            {/* Phones: the mark alone, so Library and Import keep their labels (27 §1). */}
            <BrandMark className="size-8 sm:hidden" />
            <Wordmark className="max-sm:hidden" />
          </Link>
          <nav aria-label={m['nav.main']()} className="flex items-center gap-1">
            <Link
              to="/library"
              className={buttonVariants({ variant: 'ghost', className: 'max-sm:px-3' })}
              activeProps={{
                'aria-current': 'page',
                // The ghost variant's text colour stays; forced colours pair Highlight with its text.
                className: 'bg-accent forced-colors:text-accent-foreground',
              }}
            >
              <LibraryIcon aria-hidden />
              <span className="max-sm:text-sm">{m['nav.library']()}</span>
            </Link>
            <Link
              to="/import"
              className={buttonVariants({ variant: 'primary', className: 'max-sm:px-3' })}
            >
              <UploadIcon aria-hidden />
              <span className="max-sm:text-sm">{m['nav.import']()}</span>
            </Link>
          </nav>
          <UsageMeter me={me} className="hidden w-80 lg:flex" />
          <UploadPill />
          <AccountMenu email={me.email} />
        </div>
      </header>
      <SystemBanners installHint />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-page flex-1 px-4 py-6 md:px-6 lg:px-8"
      >
        {children}
      </main>
    </div>
  )
}
