import { Link, useRouterState } from '@tanstack/react-router'
import { LibraryIcon, type LucideIcon, SettingsIcon, UploadIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { cn } from '@/lib/utils'
import { BrandMark, Wordmark } from '@/ui/brand'
import { buttonVariants } from '@/ui/button'
import { UploadPill } from '../import/upload-pill'
import { useClaimOnSignIn } from '../onboarding/claim-on-sign-in'
import { SystemBanners } from '../system/system-banners'
import { AccountMenu } from './account-menu'
import { SkipLink } from './skip-link'

type Destination = {
  to: '/library' | '/import' | '/settings/profile'
  /** The route prefix the destination covers: Settings is current for every settings section. */
  section: string
  icon: LucideIcon
  label: string
}

const isCurrent = (pathname: string, section: string) =>
  pathname === section || pathname.startsWith(`${section}/`)

// Forced colours drop the tint, so the current item takes the system Highlight pair there.
const CURRENT_FILL =
  'bg-surface-sunken forced-colors:bg-accent forced-colors:text-accent-foreground'

// App shell (27 §1): a solid 56 px bar with the wordmark (→ Library), Library, Import (the one
// primary action), Settings and the account menu. Phones swap the labelled links for a bottom tab
// bar and keep the brand mark, the upload pill and the account menu in the bar.
export function AppShell({ me, children }: { me: MeData; children: React.ReactNode }) {
  useClaimOnSignIn()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const destinations: Destination[] = [
    { to: '/library', section: '/library', icon: LibraryIcon, label: m['nav.library']() },
    { to: '/import', section: '/import', icon: UploadIcon, label: m['nav.import']() },
    {
      to: '/settings/profile',
      section: '/settings',
      icon: SettingsIcon,
      label: m['nav.settings'](),
    },
  ]
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-(--z-sticky) border-b border-border bg-background [view-transition-name:app-header]">
        <div className="mx-auto flex min-h-14 max-w-page items-center gap-2 px-3 sm:px-4 md:gap-4 md:px-6 lg:px-8">
          <Link
            to="/library"
            aria-label={m['nav.library_home']()}
            className="mr-auto inline-flex min-h-target min-w-target items-center rounded-md"
          >
            {/* Phones: the mark alone; the bottom tab bar carries the destinations (27 §1). */}
            <BrandMark className="size-8 sm:hidden" />
            <Wordmark className="max-sm:hidden" />
          </Link>
          <nav aria-label={m['nav.main']()} className="flex items-center gap-1 max-sm:hidden">
            {destinations.map(({ to, section, icon: Icon, label }) => {
              const current = isCurrent(pathname, section)
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    buttonVariants({ variant: to === '/import' ? 'primary' : 'ghost' }),
                    current && 'font-semibold',
                    current && to !== '/import' && CURRENT_FILL,
                  )}
                >
                  <Icon aria-hidden />
                  {label}
                </Link>
              )
            })}
          </nav>
          <UploadPill />
          <AccountMenu email={me.email} />
        </div>
      </header>
      <SystemBanners installHint />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-page flex-1 px-4 py-6 max-sm:pb-[calc(var(--spacing)*20+env(safe-area-inset-bottom))] md:px-6 lg:px-8"
      >
        {children}
      </main>
      <nav
        data-slot="bottom-tabs"
        aria-label={m['nav.main']()}
        className="fixed inset-x-0 bottom-0 z-(--z-sticky) bg-surface-raised pb-[env(safe-area-inset-bottom)] shadow-3 sm:hidden"
      >
        <div className="flex">
          {destinations.map(({ to, section, icon: Icon, label }) => {
            const current = isCurrent(pathname, section)
            return (
              <Link
                key={to}
                to={to}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-target min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-sm font-medium focus-visible:-outline-offset-2',
                  current && 'font-semibold',
                )}
              >
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full px-4 py-0.5 transition-colors duration-(--duration-base)',
                    current && CURRENT_FILL,
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
