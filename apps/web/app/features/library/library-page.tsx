import { LibrarySort, LibraryStatusFilter } from '@splitune/contracts'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { LayoutGridIcon, ListIcon, MusicIcon, SearchIcon, SearchXIcon, XIcon } from 'lucide-react'
import { type CSSProperties, useEffect, useState } from 'react'
import type { z } from 'zod'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import type { MeData } from '@/lib/session'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { InlineError } from '@/ui/status-message'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { WorkerStatus } from '@/ui/worker-status'
import { OptionSelect } from '../common/option-select'
import { UsageMeter } from '../shell/usage-meter'
import { LibrarySkeleton } from './library-skeleton'
import { type LibraryFilters, libraryQuery, workerStatusQuery } from './queries'
import { SongEntry } from './song-entry'
import { cardStatus, isInProgress } from './song-status'

type Sort = z.infer<typeof LibrarySort>
type StatusFilter = z.infer<typeof LibraryStatusFilter>

export type LibrarySearch = LibraryFilters & { view?: 'grid' | 'list' | undefined }

const ALL = 'all'

// Filter, sort and view changes run as a "library-reorder" view transition: styles.css names each
// entry only during one, so cards glide to their new place and morph between card and row (26 §10). Search keystrokes swap
// instantly; a transition would freeze the field's rendering while typing.
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

export function LibraryPage({ me, search }: { me: MeData; search: LibrarySearch }) {
  const navigate = useNavigate({ from: '/library' })
  const { view: chosenView = 'grid', ...filters } = search
  // Phones always get the list (27 §3.5); the grid/list toggle is for md and up.
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
  // Each page's index restarts at 0, so a loaded page staggers in like the first one did.
  const entries =
    songs.data?.pages.flatMap((page) => page.items.map((song, index) => ({ song, index }))) ?? []
  const items = entries.map((entry) => entry.song)
  const anyWaiting = items.some((song) => isInProgress(cardStatus(song, false)))
  const worker = useQuery({ ...workerStatusQuery, enabled: anyWaiting })
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
  const countText =
    songs.hasNextPage || count !== 1
      ? m['library.count_other']({ count: String(count) + (songs.hasNextPage ? '+' : '') })
      : m['library.count_one']()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-3xl">{m['library.title']()}</h1>
          {songs.isSuccess && (count > 0 || filtered) && (
            <p className="text-sm text-muted-foreground tabular-nums">{countText}</p>
          )}
        </div>
        <UsageMeter me={me} className="w-full sm:w-80 lg:hidden" />
      </header>

      {anyWaiting && worker.data && !worker.data.online && (
        <WorkerStatus online={false} text={m['analysis.queued_offline']()} />
      )}

      {(count > 0 || filtered) && (
        // biome-ignore lint/a11y/useSemanticElements: <search> is newer than the Safari 16.4 floor (24 §2)
        <div
          role="search"
          className="grid grid-cols-2 items-end gap-3 rounded-2xl bg-surface-sunken p-3 sm:flex sm:flex-wrap contrast-more:border contrast-more:border-border"
        >
          <div className="col-span-2 flex min-w-56 flex-1 flex-col gap-1.5">
            <Label htmlFor="library-search">{m['library.search_label']()}</Label>
            <div className="relative">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="library-search"
                type="search"
                className="pl-10"
                placeholder={m['library.search_placeholder']()}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <OptionSelect
            label={m['library.filter_instrument']()}
            value={search.instrument ?? ALL}
            options={[
              { value: ALL, label: m['library.filter_all']() },
              ...INSTRUMENTS.map((value) => ({ value, label: instrumentLabel(value) })),
            ]}
            onChange={(value) =>
              setSearch({ instrument: value === ALL ? undefined : (value as InstrumentName) })
            }
            className="w-full sm:w-40"
          />
          <OptionSelect
            label={m['library.filter_status']()}
            value={search.status ?? ALL}
            options={[
              { value: ALL, label: m['library.filter_all']() },
              ...LibraryStatusFilter.options.map((value) => ({ value, label: statusLabel(value) })),
            ]}
            onChange={(value) =>
              setSearch({ status: value === ALL ? undefined : (value as StatusFilter) })
            }
            className="w-full sm:w-40"
          />
          {/* Two filters share a phone row; sort takes the next one. */}
          <div className="col-span-2 sm:contents">
            <OptionSelect
              label={m['library.sort_label']()}
              value={search.sort ?? 'last_practised'}
              options={LibrarySort.options.map((value) => ({ value, label: sortLabel(value) }))}
              onChange={(value) =>
                setSearch({ sort: value === 'last_practised' ? undefined : value })
              }
              className="w-full sm:w-44"
            />
          </div>
          {filtered && count > 0 && (
            <Button variant="ghost" className="animate-pop-in" onClick={clearFilters}>
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
      )}

      {songs.isError && (
        <InlineError
          title={m['library.load_error']()}
          actions={
            <Button variant="outline" onClick={() => songs.refetch()}>
              {m['common.retry']()}
            </Button>
          }
        />
      )}

      {songs.isPending ? (
        <LibrarySkeleton />
      ) : count === 0 && !songs.isError ? (
        filtered ? (
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
          <EmptyState
            className="animate-rise-in"
            icon={<MusicIcon aria-hidden />}
            description={m['library.empty']()}
            action={
              <Link to="/import" className={buttonVariants({ variant: 'primary' })}>
                {m['library.import_song']()}
              </Link>
            }
            secondaryAction={
              <Link to="/start" className={buttonVariants({ variant: 'outline' })}>
                {m['library.try_example']()}
              </Link>
            }
          />
        )
      ) : (
        <>
          <h2 className="sr-only">{m['library.songs_heading']()}</h2>
          <ul
            className={
              view === 'grid'
                ? 'stagger-children grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'stagger-children list-none divide-y divide-border rounded-2xl bg-surface-raised p-0 shadow-1 contrast-more:border contrast-more:border-border'
            }
          >
            {entries.map(({ song, index }) => (
              <li
                key={song.id}
                data-vt-song
                className={cn(
                  'animate-rise-in',
                  // Rows clip their hover wash to the list's rounded corners.
                  view === 'list' && 'overflow-hidden first:rounded-t-2xl last:rounded-b-2xl',
                )}
                style={{ '--i': index, '--vt-song': `song-${song.id}` } as CSSProperties}
              >
                <SongEntry song={song} layout={view} />
              </li>
            ))}
          </ul>
        </>
      )}

      {songs.hasNextPage && (
        <Button
          variant="outline"
          className="self-center"
          loading={songs.isFetchingNextPage}
          onClick={() => songs.fetchNextPage()}
        >
          {m['library.load_more']()}
        </Button>
      )}
    </div>
  )
}
