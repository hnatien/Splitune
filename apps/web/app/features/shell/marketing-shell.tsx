import { Link, useRouterState } from '@tanstack/react-router'
import { CheckIcon, MenuIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/ui/brand'
import { Button, buttonVariants } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { SystemBanners } from '../system/system-banners'
import { SkipLink } from './skip-link'

// Marketing shell (27 §1, s47 direction §1): a 64 px bar with no rule under it, pinned at the top.
// How it works and Pricing are muted text links; the page you are on has a 2 px ink line under its
// name (aria-current), in the bar and the footer alike. The bar has no filled control: each page
// owns its one primary, so the bar's way in ("Try an example song", or "Library" when signed in)
// is an outline pill and Sign in is quiet. On phones the way in stays in the bar beside the
// wordmark and the rest sits behind the Menu button, so the bar is one row. The system banners sit
// under the bar on the same grid, and the footer carries the legal links.

const GRID = 'mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8'

/** The current page's name gets a 2 px ink line under it; the others are muted until hovered. */
const NAV_LINK = cn(
  buttonVariants({ variant: 'quiet' }),
  'relative after:absolute after:inset-x-4.5 after:bottom-0.5 after:h-0.5 after:rounded-full aria-[current=page]:text-foreground aria-[current=page]:after:bg-selected',
)

const FOOTER_LINK =
  'relative inline-flex min-h-target items-center text-muted-foreground transition-colors duration-(--duration-fast) after:absolute after:inset-x-0 after:bottom-2 after:h-0.5 after:rounded-full hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:after:bg-selected'

export function MarketingShell({
  signedIn,
  children,
}: {
  signedIn: boolean
  children: React.ReactNode
}) {
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-(--z-sticky) bg-background [view-transition-name:app-header]">
        <div className={cn(GRID, 'flex min-h-16 items-center gap-2')}>
          <Link
            to="/"
            aria-label={m['nav.home']()}
            className="mr-auto inline-flex min-h-target items-center rounded-media"
          >
            <Wordmark />
          </Link>
          <nav aria-label={m['nav.main']()} className="flex items-center gap-1 max-sm:hidden">
            <Link to="/how-it-works" className={NAV_LINK}>
              {m['nav.how_it_works']()}
            </Link>
            <Link to="/pricing" className={NAV_LINK}>
              {m['nav.pricing']()}
            </Link>
            {!signedIn && (
              <Link to="/auth/sign-in" className={NAV_LINK}>
                {m['nav.sign_in']()}
              </Link>
            )}
          </nav>
          <WayIn signedIn={signedIn} />
          <PhoneMenu signedIn={signedIn} />
        </div>
      </header>
      <SystemBanners />
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

/** The bar's one way into the app: the example song, or the library once signed in. */
function WayIn({ signedIn }: { signedIn: boolean }) {
  const className = cn(buttonVariants({ variant: 'outline' }), 'max-sm:hidden sm:ml-2')
  const phone = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'sm:hidden')
  return signedIn ? (
    <>
      <Link to="/library" className={className}>
        {m['nav.library']()}
      </Link>
      <Link to="/library" className={phone}>
        {m['nav.library']()}
      </Link>
    </>
  ) : (
    <>
      <Link to="/start" className={className}>
        {m['home.cta_example']()}
      </Link>
      <Link to="/start" className={phone}>
        {m['home.cta_example']()}
      </Link>
    </>
  )
}

/** Below `sm`: the pages and Sign in, the current page marked with a check. */
function PhoneMenu({ signedIn }: { signedIn: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const items = [
    { to: '/how-it-works', label: m['nav.how_it_works']() },
    { to: '/pricing', label: m['nav.pricing']() },
    ...(signedIn ? [] : [{ to: '/auth/sign-in', label: m['nav.sign_in']() }]),
  ] as const
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="quiet" size="icon" aria-label={m['nav.menu']()} className="sm:hidden" />
        }
      >
        <MenuIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {items.map((item) => (
          <DropdownMenuItem key={item.to} render={<Link to={item.to} />}>
            <span className="flex-1">{item.label}</span>
            {pathname === item.to && <CheckIcon aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteFooter() {
  return (
    <footer className={GRID}>
      <nav
        aria-label={m['footer.nav']()}
        className="flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-border py-8 text-label"
      >
        <Wordmark tone="mono" className="mr-auto text-body text-muted-foreground max-sm:w-full" />
        <Link to="/how-it-works" className={FOOTER_LINK}>
          {m['nav.how_it_works']()}
        </Link>
        <Link to="/pricing" className={FOOTER_LINK}>
          {m['nav.pricing']()}
        </Link>
        <Link to="/legal/$page" params={{ page: 'terms' }} className={FOOTER_LINK}>
          {m['legal.terms_title']()}
        </Link>
        <Link to="/legal/$page" params={{ page: 'privacy' }} className={FOOTER_LINK}>
          {m['legal.privacy_title']()}
        </Link>
      </nav>
    </footer>
  )
}
