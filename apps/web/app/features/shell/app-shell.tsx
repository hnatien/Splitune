import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { LibraryIcon, PlusIcon, SearchIcon, SettingsIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useRef } from 'react'
import { m } from '@/lib/i18n'
import type { MeData } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/ui/brand'
import { Button } from '@/ui/button'
import { Kbd } from '@/ui/kbd'
import { Panel } from '@/ui/panel'
import { WorkerStatus } from '@/ui/worker-status'
import { ADD_SONG_KEY, useOpenAddSong } from '../import/add-song-state'
import { UploadPill } from '../import/upload-pill'
import { libraryQuery, workerStatusQuery } from '../library/queries'
import { useClaimOnSignIn } from '../onboarding/claim-on-sign-in'
import { useKeys } from '../practice/keys-store'
import { SystemBanners } from '../system/system-banners'
import { AccountMenu } from './account-menu'
import { AddSongHost } from './add-song-host'
import { BottomNav } from './bottom-nav'
import { DropOverlay } from './drop-overlay'
import { PaletteLauncher } from './palette-launcher'
import { usePalette } from './palette-store'
import { SkipLink } from './skip-link'

export const isCurrent = (pathname: string, section: string) =>
  pathname === section || pathname.startsWith(`${section}/`)

const RECENT = 3

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

/**
 * A rail item's key cap, painted from an attribute: the key is a label on the control, so it stays
 * out of the control's name and text (WCAG 2.5.3); `aria-keyshortcuts` carries it instead.
 */
function KeyCap({ keys }: { keys: string }) {
  return <Kbd aria-hidden data-keys={keys} className="before:content-[attr(data-keys)]" />
}

/**
 * A rail item (26 §7): muted text with no fill at rest, the hover wash, and the current page
 * marked by a 2 px ink line on its leading side (a border, so forced colours keep it).
 */
export const RAIL_ITEM =
  'relative flex min-h-target w-full items-center gap-3 rounded-field px-3 text-left text-label text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-hover hover:text-foreground data-popup-open:bg-hover data-popup-open:text-foreground aria-[current=page]:text-foreground aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2.5 aria-[current=page]:before:left-0 aria-[current=page]:before:border-l-2 aria-[current=page]:before:border-selected focus-visible:-outline-offset-2 [&_svg]:size-5 [&_svg]:shrink-0 [&_.lucide]:stroke-[1.8]'

/**
 * `A` opens Add song (WCAG 2.1.4: it follows the single-key switch in Settings → Keyboard & pedal),
 * except while typing or inside a dialog or menu, where the letter belongs to what has focus.
 */
function useAddSongKey(open: () => void) {
  const singleKeys = useKeys((s) => s.singleKeys)
  const latest = useRef(open)
  latest.current = open
  useEffect(() => {
    if (!singleKeys) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== ADD_SONG_KEY.toLowerCase()) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat || event.defaultPrevented)
        return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (
        target?.isContentEditable ||
        target?.closest('input, textarea, select, [role=dialog], [role=menu], [role=listbox]')
      )
        return
      event.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [singleKeys])
}

/** The three songs opened last, for the rail's Recent list (the library's own first page). */
function useRecentSongs() {
  const songs = useInfiniteQuery(libraryQuery({}))
  return (songs.data?.pages[0]?.items ?? [])
    .filter((song) => song.last_opened_at !== null)
    .slice(0, RECENT)
}

// App shell (s47 direction §6, 26 §7): from 1024 px a 232 px rail (the wordmark, Library and
// Settings with the current one marked by an ink line, Add song and Search with their keys, the
// songs opened last, then the upload, the processing machine and the account) beside one
// main column, with no top bar. Below that a 48 px top bar (the wordmark, search, account;
// the page names itself in its own h1) and the bottom bar. A file dropped anywhere opens Add song
// with it.
export function AppShell({ me, children }: { me: MeData; children: React.ReactNode }) {
  useClaimOnSignIn()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const openAddSong = useOpenAddSong()
  useAddSongKey(() => openAddSong())
  const name = me.display_name || me.username || me.email
  const settings = isCurrent(pathname, '/settings')
  return (
    <div data-density="browse" className="flex min-h-dvh">
      <SkipLink />
      <Rail me={me} name={name} pathname={pathname} onAddSong={() => openAddSong()} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-(--z-sticky) bg-background pt-[env(safe-area-inset-top)] lg:hidden [view-transition-name:app-header]">
          <div className="flex min-h-12 items-center gap-1 pr-1 pl-2 sm:pr-3 sm:pl-4">
            <Link
              to="/library"
              aria-label={m['nav.library_home']()}
              className="flex min-h-target shrink-0 items-center rounded-field px-2"
            >
              <Wordmark />
            </Link>
            <div className="flex-1" />
            <UploadPill />
            <Button
              variant="quiet"
              size="icon"
              aria-label={m['nav.search']()}
              onClick={openPalette}
            >
              <SearchIcon aria-hidden />
            </Button>
            <AccountMenu me={me} name={name} username={me.username} />
          </div>
        </header>
        <SystemBanners installHint />
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            'mx-auto flex w-full flex-1 flex-col px-4 pt-4 pb-[calc(var(--spacing)*22+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-8 lg:pb-16',
            settings ? 'max-w-settings' : 'max-w-library',
          )}
        >
          {children}
        </main>
      </div>
      <BottomNav pathname={pathname} onAddSong={() => openAddSong()} />
      <DropOverlay onFile={(file) => openAddSong('file', file)} />
      <PaletteLauncher />
      <AddSongHost me={me} />
    </div>
  )
}

function Rail({
  me,
  name,
  pathname,
  onAddSong,
}: {
  me: MeData
  name: string
  pathname: string
  onAddSong: () => void
}) {
  const recent = useRecentSongs()
  const worker = useQuery(workerStatusQuery)
  return (
    <Panel
      side="left"
      aria-label={m['nav.app']()}
      className="sticky top-0 h-dvh w-58 gap-6 overflow-y-auto px-3 pt-3 pb-4 max-lg:hidden"
    >
      <Link
        to="/library"
        aria-label={m['nav.library_home']()}
        className="flex min-h-target items-center self-start rounded-field px-3"
      >
        <Wordmark />
      </Link>
      <nav aria-label={m['nav.main']()} className="flex flex-col gap-0.5">
        <Link
          to="/library"
          aria-current={isCurrent(pathname, '/library') ? 'page' : undefined}
          className={RAIL_ITEM}
        >
          <LibraryIcon aria-hidden />
          {m['nav.library']()}
        </Link>
        <button
          type="button"
          aria-keyshortcuts={ADD_SONG_KEY}
          onClick={onAddSong}
          className={RAIL_ITEM}
        >
          <PlusIcon aria-hidden />
          <span className="flex-1">{m['nav.add_song']()}</span>
          <KeyCap keys={ADD_SONG_KEY} />
        </button>
        <button
          type="button"
          aria-label={m['nav.search']()}
          aria-keyshortcuts="Control+K Meta+K"
          onClick={openPalette}
          className={RAIL_ITEM}
        >
          <SearchIcon aria-hidden />
          <span className="flex-1">{m['nav.search_short']()}</span>
          <KeyCap keys={paletteKey()} />
        </button>
        <Link
          to="/settings"
          aria-current={isCurrent(pathname, '/settings') ? 'page' : undefined}
          className={RAIL_ITEM}
        >
          <SettingsIcon aria-hidden />
          {m['nav.settings']()}
        </Link>
      </nav>
      {recent.length > 0 && (
        <section aria-labelledby="rail-recent" className="flex flex-col gap-0.5">
          <h2 id="rail-recent" className="px-3 pb-1 text-label-sm text-faint-foreground">
            {m['nav.recent']()}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {recent.map((song) => (
              <li key={song.id}>
                <Link
                  to="/songs/$songId/practice"
                  params={{ songId: song.id }}
                  className={RAIL_ITEM}
                >
                  <span className="min-w-0 truncate">{song.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-auto flex flex-col gap-0.5">
        <div className="px-1 empty:hidden">
          <UploadPill />
        </div>
        {worker.data && (
          <WorkerStatus
            online={worker.data.online}
            text={worker.data.online ? m['nav.worker_online']() : m['nav.worker_offline']()}
            className="px-3"
          />
        )}
        <AccountMenu me={me} name={name} username={me.username} layout="rail" />
      </div>
    </Panel>
  )
}
