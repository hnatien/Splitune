import { Link, useRouterState } from '@tanstack/react-router'
import { PlusIcon, SearchIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { cn } from '@/lib/utils'
import { BrandMark, Wordmark } from '@/ui/brand'
import { Button, buttonVariants } from '@/ui/button'
import { Kbd } from '@/ui/kbd'
import { useOpenAddSong } from '../import/add-song-state'
import { UploadPill } from '../import/upload-pill'
import { useClaimOnSignIn } from '../onboarding/claim-on-sign-in'
import { SystemBanners } from '../system/system-banners'
import { AccountMenu } from './account-menu'
import { AddSongHost } from './add-song-host'
import { BottomNav } from './bottom-nav'
import { DropOverlay } from './drop-overlay'
import { PaletteLauncher } from './palette-launcher'
import { usePalette } from './palette-store'
import { SkipLink } from './skip-link'
import { UsageMeter } from './usage-meter'

export const isCurrent = (pathname: string, section: string) =>
  pathname === section || pathname.startsWith(`${section}/`)

// The palette's shortcut as this platform writes it (feature detection: the platform string, never
// the user agent).
function paletteKey() {
  const platform =
    typeof navigator === 'undefined'
      ? ''
      : ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
          ?.platform ?? navigator.platform)
  return /mac|iphone|ipad/i.test(platform) ? m['nav.palette_key_mac']() : m['nav.palette_key']()
}

const openPalette = () => usePalette.getState().setOpen(true)

// App shell (27 §1, 26 §7, §12.2 AppBar): a sticky 64 px bar with the wordmark (→ Library), Library
// and Settings, the search button that opens the ⌘K palette, the allowance (from lg), Add song (the
// view's one primary) and the account menu. Phones get a 56 px header with the page title, search
// and the account menu, and the 76 px bottom bar. A file dropped anywhere opens Add song with it.
export function AppShell({ me, children }: { me: MeData; children: React.ReactNode }) {
  useClaimOnSignIn()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const openAddSong = useOpenAddSong()
  const name = me.display_name || me.username || me.email
  const links = [
    { to: '/library', section: '/library', label: m['nav.library']() },
    { to: '/settings/account', section: '/settings', label: m['nav.settings']() },
  ] as const
  return (
    <div data-density="browse" className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-(--z-sticky) border-border bg-background pt-[env(safe-area-inset-top)] sm:border-b [view-transition-name:app-header]">
        <div className="flex min-h-14 flex-wrap items-center gap-2 pr-2 pl-4 sm:min-h-16 sm:gap-3.5 sm:px-5">
          <Link
            to="/library"
            aria-label={m['nav.library_home']()}
            className="inline-flex min-h-target items-center gap-2.5 rounded-md max-sm:hidden"
          >
            <Wordmark />
          </Link>
          <BrandMark className="size-6.5 sm:hidden" />
          <p className="flex-1 truncate text-lg font-bold sm:hidden">
            {isCurrent(pathname, '/settings') ? m['settings.title']() : m['library.title']()}
          </p>
          <nav aria-label={m['nav.main']()} className="ml-3 flex gap-1 max-sm:hidden">
            {links.map(({ to, section, label }) => {
              const current = isCurrent(pathname, section)
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'px-3',
                    current &&
                      'bg-muted text-foreground forced-colors:bg-accent forced-colors:text-accent-foreground',
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="flex-1 max-sm:hidden" />
          <Button
            variant="quiet"
            onClick={openPalette}
            className="w-81 min-w-0 shrink justify-start px-3 font-medium text-faint-foreground max-lg:hidden [&>span]:w-full [&>span]:min-w-0"
          >
            <SearchIcon aria-hidden className="size-4" />
            <span className="min-w-0 flex-1 truncate text-left">{m['nav.search']()}</span>
            <Kbd>{paletteKey()}</Kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={m['nav.search']()}
            onClick={openPalette}
            className="lg:hidden"
          >
            <SearchIcon aria-hidden />
          </Button>
          <div className="flex-1 max-lg:hidden" />
          <UsageMeter me={me} className="max-lg:hidden" />
          <UploadPill />
          <Button variant="primary" onClick={() => openAddSong()} className="max-sm:hidden">
            <PlusIcon aria-hidden className="size-4" />
            {m['nav.add_song']()}
          </Button>
          <AccountMenu name={name} />
        </div>
      </header>
      <SystemBanners installHint />
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          'mx-auto flex w-full flex-1 flex-col max-sm:pb-[calc(var(--spacing)*23+env(safe-area-inset-bottom))]',
          // The library has its own container (26 §7: 1260, padding 28/24/48); settings keep theirs.
          isCurrent(pathname, '/library')
            ? 'max-w-library px-4 pt-1 sm:px-6 sm:pt-7 sm:pb-12'
            : 'max-w-page px-4 py-6 md:px-6 lg:px-8',
        )}
      >
        {children}
      </main>
      <BottomNav pathname={pathname} onAddSong={() => openAddSong()} />
      <DropOverlay onFile={(file) => openAddSong('file', file)} />
      <PaletteLauncher />
      <AddSongHost me={me} />
    </div>
  )
}
