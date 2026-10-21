import { Link } from '@tanstack/react-router'
import { LibraryIcon, UploadIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { BrandMark, Wordmark } from '@/ui/brand'
import { buttonVariants } from '@/ui/button'
import { UploadPill } from '../import/upload-pill'
import { SystemBanners } from '../system/system-banners'
import { AccountMenu } from './account-menu'
import { SkipLink } from './skip-link'
import { UsageMeter } from './usage-meter'

// App shell (27 §1): 56 px bar with the wordmark (→ Library), Library, Import (the one primary
// action), the allowance meter from md up and the account menu. Library, import and settings.
export function AppShell({ me, children }: { me: MeData; children: React.ReactNode }) {
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-(--z-sticky) border-b border-border bg-background">
        <div className="mx-auto flex min-h-14 max-w-page items-center gap-2 px-4 md:gap-4 md:px-6 lg:px-8">
          <Link to="/library" aria-label={m['nav.library_home']()} className="mr-auto rounded-md">
            {/* Phones: the mark alone, so Library and Import keep their labels (27 §1). */}
            <BrandMark className="size-8 sm:hidden" />
            <Wordmark className="max-sm:hidden" />
          </Link>
          <nav aria-label={m['nav.main']()} className="flex items-center gap-1">
            <Link
              to="/library"
              className={buttonVariants({ variant: 'ghost' })}
              activeProps={{
                'aria-current': 'page',
                className: 'bg-accent text-accent-foreground',
              }}
            >
              <LibraryIcon aria-hidden />
              <span className="max-sm:text-sm">{m['nav.library']()}</span>
            </Link>
            <Link to="/import" className={buttonVariants({ variant: 'primary' })}>
              <UploadIcon aria-hidden />
              <span className="max-sm:text-sm">{m['nav.import']()}</span>
            </Link>
          </nav>
          <UsageMeter me={me} className="hidden w-64 lg:flex" />
          <UploadPill />
          <AccountMenu email={me.email} />
        </div>
      </header>
      <SystemBanners />
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
