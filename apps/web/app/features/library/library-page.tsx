import { type LibrarySong, LibrarySort, LibraryStatusFilter } from '@splitune/contracts'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronDownIcon,
  LayoutGridIcon,
  ListIcon,
  MusicIcon,
  SearchIcon,
  SearchXIcon,
  XIcon,
} from 'lucide-react'
import { type ComponentProps, type CSSProperties, useEffect, useState } from 'react'
import type { z } from 'zod'
import { barNumber, formatPercent, formatRelativeDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { useMediaQuery } from '@/lib/use-media-query'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { EmptyState } from '@/ui/empty-state'
import { Input } from '@/ui/input'
import { InlineError } from '@/ui/status-message'
import { Toggle } from '@/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { WorkerStatus } from '@/ui/worker-status'
import { useOpenAddSong } from '../import/add-song-state'
import { ContinueCard, ContinueCardCompact, type ContinueSummary } from './continue-card'
import { LibrarySkeleton, SongsSkeleton } from './library-skeleton'
import { type LibraryFilters, libraryQuery, workerStatusQuery } from './queries'
import { SongEntry } from './song-entry'
import { cardStatus, isInProgress } from './song-status'

type Song = z.infer<typeof LibrarySong>
type Sort = z.infer<typeof LibrarySort>
type StatusFilter = z.infer<typeof LibraryStatusFilter>

export type LibrarySearch = LibraryFilters & { view?: 'grid' | 'list' | undefined }

const ALL = 'all'

// Filter, sort and view changes run as a "library-reorder" view transition: styles.css names each
// entry only during one, so cards glide to their new place and morph between card and row (26 §10).
// Search keystrokes swap instantly; a transition would freeze the field's rendering while typing.
const REORDER = { types: ['library-reorder'] }

function sortLabel(sort: Sort): string {
  if (sort === 'added') return m['library.sort_added']()
  if (sort === 'title') return m['library.sort_title']()
  return m['library.sort_last_practised']()
}

function statusLabel(status: StatusFilter): string {
  switch (status) {
    case 'ready':
      return m['library.status.ready']()
    case 'partial':
      return m['library.status.partial']()
    case 'analysing':
      return m['library.filter_analysing']()
    default:
      return m['library.status.failed']()
  }
}

/** Before s39 (27 §3.5): the most recently opened song, its part and its best clean tempo. */
function continueSummary(song: Song): ContinueSummary {
  const best = song.best_clean
  return {
    title: song.title,
    meta: [
      song.artist,
      instrumentLabel(song.instrument),
      best &&
        m['library.bars']({
          start: String(barNumber(best.start_bar)),
          end: String(barNumber(best.end_bar)),
        }),
    ]
      .filter(Boolean)
      .join(' · '),
    when: formatRelativeDate(new Date(song.last_opened_at ?? song.created_at)),
    badges: best
      ? [
          {
            label: m['library.best_clean']({ pct: formatPercent(best.tempo_pct) }),
            variant: 'neutral',
          },
        ]
      : [],
  }
}

const practiceLink =
  (song: Song) =>
  ({ className, children }: ComponentProps<'a'>) => (
    <Link to="/songs/$songId/practice" params={{ songId: song.id }} className={className}>
      {children}
    </Link>
  )

// Library (27 §3.5, §4; Library, Phone-Library and States mockups): the Continue card, then Songs
// with its toolbar (filter, instrument chips, sort and status menu, Grid/List; all in the URL) and
// the cards, 24 at a time. This week and Worth a revisit wait for progress data (s39).
export function LibraryPage({ search }: { search: LibrarySearch }) {
  const navigate = useNavigate({ from: '/library' })
  const openAddSong = useOpenAddSong()
  const online = useOnline()
  const { view: chosenView = 'grid', ...filters } = search
  const wide = useMediaQuery('(min-width: 640px)')
  // Phones always get rows (27 §3.5); Grid/List is for tablets and desktops.
  const view = useMediaQuery('(min-width: 768px)') ? chosenView : 'list'
  const songs = useInfiniteQuery({
    ...libraryQuery(filters),
    // Cards of songs being analysed refresh themselves; the list catches status changes.
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.items.some((song) => isInProgress(cardStatus(song, false))),
      )
        ? 10_000
        : false,
  })
  // The Continue card follows the most recently opened song whatever the filters show (the
  // unfiltered first page: the same request when no filter is on).
  const recent = useInfiniteQuery({ ...libraryQuery({}), enabled: songs.isSuccess })
  const last = recent.data?.pages[0]?.items.find((song) => song.last_opened_at !== null)
  // Each page's index restarts at 0, so a loaded page staggers in like the first one did.
  const entries =
    songs.data?.pages.flatMap((page) => page.items.map((song, index) => ({ song, index }))) ?? []
  const items = entries.map((entry) => entry.song)
  const anyWaiting = items.some((song) => isInProgress(cardStatus(song, false)))
  const worker = useQuery({ ...workerStatusQuery, enabled: anyWaiting })
  const workerOffline = anyWaiting && worker.data?.online === false
  const [query, setQuery] = useState(search.q ?? '')
  useEffect(() => setQuery(search.q ?? ''), [search.q])

  const setSearch = (
    patch: Partial<LibrarySearch>,
    viewTransition: typeof REORDER | false = REORDER,
  ) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true, viewTransition })

  const clearFilters = () => {
    setQuery('')
    void navigate({
      search: { view: search.view, sort: search.sort },
      replace: true,
      viewTransition: REORDER,
    })
  }

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === (search.q ?? '')) return
    const timer = setTimeout(() => setSearch({ q: trimmed || undefined }, false), 300)
    return () => clearTimeout(timer)
  })

  const filtered = Boolean(search.q || search.instrument || search.status)
  const count = items.length
  const empty = songs.isSuccess && count === 0 && !filtered

  if (songs.isPending && !filtered) return <LibrarySkeleton />

  const sortMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" />}>
        <span className="sr-only">{m['library.sort_menu']()}: </span>
        {sortLabel(search.sort ?? 'last_practised')}
        {search.status && ` · ${statusLabel(search.status)}`}
        <ChevronDownIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m['library.sort_by']()}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={search.sort ?? 'last_practised'}
            onValueChange={(value) =>
              setSearch({ sort: value === 'last_practised' ? undefined : (value as Sort) })
            }
          >
            {LibrarySort.options.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {sortLabel(value)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m['library.show']()}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={search.status ?? ALL}
            onValueChange={(value) =>
              setSearch({ status: value === ALL ? undefined : (value as StatusFilter) })
            }
          >
            <DropdownMenuRadioItem value={ALL}>{m['library.filter_all']()}</DropdownMenuRadioItem>
            {LibraryStatusFilter.options.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {statusLabel(value)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const chips = (
    // biome-ignore lint/a11y/useSemanticElements: a toolbar group of toggles, not a form fieldset
    <div
      role="group"
      aria-label={m['library.filter_instrument']()}
      className="flex gap-1.5 max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-4 sm:flex-wrap"
    >
      {[undefined, ...INSTRUMENTS].map((instrument) => (
        <Toggle
          key={instrument ?? ALL}
          pressed={search.instrument === instrument}
          onPressedChange={() =>
            setSearch({ instrument: instrument as InstrumentName | undefined })
          }
        >
          {instrument ? instrumentLabel(instrument) : m['library.filter_all']()}
        </Toggle>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4 sm:gap-7">
      {!last && <h1 className="sr-only">{m['library.title']()}</h1>}

      {workerOffline && <WorkerStatus online={false} text={m['analysis.queued_offline']()} />}

      {last &&
        (wide ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
            <ContinueCard
              song={continueSummary(last)}
              renderLink={practiceLink(last)}
              className="col-span-full lg:col-span-2"
            />
          </div>
        ) : (
          <>
            <h1 className="sr-only">{m['library.title']()}</h1>
            <ContinueCardCompact song={continueSummary(last)} renderLink={practiceLink(last)} />
          </>
        ))}

      {empty ? (
        <EmptyState
          className="animate-rise-in"
          icon={<MusicIcon aria-hidden />}
          title={m['library.empty']()}
          description={m['library.empty_body']()}
          action={
            <Button variant="primary" onClick={() => openAddSong()}>
              {m['nav.add_song']()}
            </Button>
          }
          secondaryAction={
            <Link to="/start" className={buttonVariants({ variant: 'secondary' })}>
              {m['library.try_example']()}
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="songs-title" className="flex flex-col gap-3.5">
          {/* biome-ignore lint/a11y/useSemanticElements: <search> is newer than the Safari 16.4 floor (24 §2) */}
          <div role="search" className="flex flex-wrap items-center gap-2.5">
            <h2 id="songs-title" className={cn('text-lg', !wide && 'sr-only')}>
              {m['library.songs_heading']()}
              {songs.isSuccess && (
                <span className="font-medium text-faint-foreground tabular-nums">
                  {' '}
                  · {count}
                  {songs.hasNextPage && '+'}
                </span>
              )}
            </h2>
            <div className="flex-1 max-sm:hidden" />
            <div className="relative w-55 max-sm:hidden">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint-foreground"
              />
              <Input
                type="search"
                aria-label={m['library.filter_title']()}
                placeholder={m['library.filter_title']()}
                className="pl-9 text-md"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {wide && chips}
            {sortMenu}
            {filtered && (
              <Button variant="ghost" size="sm" className="animate-pop-in" onClick={clearFilters}>
                <XIcon aria-hidden />
                {m['library.clear_filters']()}
              </Button>
            )}
            <ToggleGroup
              data-vt-view-toggle
              aria-label={m['library.view_label']()}
              className="hidden md:flex"
              value={[chosenView]}
              onValueChange={(value) => {
                const next = value[0] as 'grid' | 'list' | undefined
                if (next) setSearch({ view: next === 'grid' ? undefined : next })
              }}
            >
              <ToggleGroupItem value="grid" aria-label={m['library.view_grid']()}>
                <LayoutGridIcon aria-hidden />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label={m['library.view_list']()}>
                <ListIcon aria-hidden />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {!wide && chips}

          {songs.isError && (
            <InlineError
              title={m['library.load_error']()}
              actions={<Button onClick={() => songs.refetch()}>{m['common.retry']()}</Button>}
            />
          )}

          {songs.isPending ? (
            <SongsSkeleton />
          ) : count === 0 && filtered ? (
            <EmptyState
              className="animate-rise-in"
              icon={<SearchXIcon aria-hidden />}
              description={m['library.no_results']()}
              action={
                <Button variant="primary" onClick={clearFilters}>
                  {m['library.clear_filters']()}
                </Button>
              }
            />
          ) : (
            <ul
              className={
                view === 'grid'
                  ? 'stagger-children grid list-none grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3.5 p-0'
                  : 'stagger-children flex list-none flex-col gap-0.5 p-0'
              }
            >
              {entries.map(({ song, index }) => (
                <li
                  key={song.id}
                  data-vt-song
                  className="animate-rise-in"
                  style={{ '--i': index, '--vt-song': `song-${song.id}` } as CSSProperties}
                >
                  <SongEntry
                    song={song}
                    layout={view}
                    workerOffline={workerOffline}
                    unavailable={!online && cardStatus(song, false).kind !== 'ready'}
                  />
                </li>
              ))}
            </ul>
          )}

          {songs.hasNextPage && (
            <Button
              className="self-center"
              loading={songs.isFetchingNextPage}
              onClick={() => songs.fetchNextPage()}
            >
              {m['library.load_more']()}
            </Button>
          )}
        </section>
      )}
    </div>
  )
}
