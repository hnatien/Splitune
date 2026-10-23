import { Link } from '@tanstack/react-router'
import { MenuIcon } from 'lucide-react'
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

// Marketing shell (27 §1): 64 px bar with How it works · Pricing · Sign in · Try an example song,
// legal links in the footer; no app chrome. Phones reach How it works and Pricing through the Menu
// button. Signed-in visitors get "Library" instead of Sign in.
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
      <SystemBanners />
      <header className="border-b border-border bg-background [view-transition-name:app-header]">
        <div className="mx-auto flex min-h-16 max-w-page flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 md:px-6 lg:px-8">
          <Link
            to="/"
            aria-label={m['nav.home']()}
            className="inline-flex min-h-target items-center rounded-md"
          >
            <Wordmark />
          </Link>
          <nav
            aria-label={m['nav.main']()}
            className="flex flex-1 flex-wrap items-center justify-end gap-1"
          >
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="sm:hidden" />}>
                <MenuIcon aria-hidden />
                {m['nav.menu']()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link to="/how-it-works" />}>
                  {m['nav.how_it_works']()}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/pricing" />}>
                  {m['nav.pricing']()}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              to="/how-it-works"
              className={cn(buttonVariants({ variant: 'ghost' }), 'max-sm:hidden')}
            >
              {m['nav.how_it_works']()}
            </Link>
            <Link
              to="/pricing"
              className={cn(buttonVariants({ variant: 'ghost' }), 'max-sm:hidden')}
            >
              {m['nav.pricing']()}
            </Link>
            {signedIn ? (
              <Link to="/library" className={buttonVariants({ variant: 'outline' })}>
                {m['nav.library']()}
              </Link>
            ) : (
              <>
                <Link to="/auth/sign-in" className={buttonVariants({ variant: 'ghost' })}>
                  {m['nav.sign_in']()}
                </Link>
                <Link to="/start" className={buttonVariants({ variant: 'primary' })}>
                  {m['home.cta_example']()}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <nav
        aria-label={m['footer.nav']()}
        className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 px-4 py-4 text-sm text-muted-foreground md:px-6 lg:px-8"
      >
        <Wordmark tone="mono" className="text-base text-muted-foreground" />
        <Link
          to="/how-it-works"
          className="inline-flex min-h-target min-w-target items-center justify-center underline-offset-4 hover:underline"
        >
          {m['nav.how_it_works']()}
        </Link>
        <Link
          to="/pricing"
          className="inline-flex min-h-target min-w-target items-center justify-center underline-offset-4 hover:underline"
        >
          {m['nav.pricing']()}
        </Link>
        <Link
          to="/legal/$page"
          params={{ page: 'terms' }}
          className="inline-flex min-h-target min-w-target items-center justify-center underline-offset-4 hover:underline"
        >
          {m['legal.terms_title']()}
        </Link>
        <Link
          to="/legal/$page"
          params={{ page: 'privacy' }}
          className="inline-flex min-h-target min-w-target items-center justify-center underline-offset-4 hover:underline"
        >
          {m['legal.privacy_title']()}
        </Link>
      </nav>
    </footer>
  )
}
