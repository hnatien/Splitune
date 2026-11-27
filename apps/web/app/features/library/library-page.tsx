import { type LibrarySong, LibrarySort, LibraryStatusFilter } from '@splitune/contracts'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronDownIcon, MusicIcon, SearchIcon, SearchXIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { z } from 'zod'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { useMediaQuery } from '@/lib/use-media-query'
import { useOnline } from '@/lib/use-online'
import { Button, buttonVariants } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { EmptyState } from '@/ui/empty-state'
import { Input } from '@/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { InlineError } from '@/ui/status-message'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { WorkerStatus } from '@/ui/worker-status'
import { ADD_SONG_KEY, useOpenAddSong } from '../import/add-song-state'
import { isUploading, useUploads } from '../import/upload-store'
import { AddSongTile } from './add-song-tile'
import { ContinueBlock } from './continue-card'
import { useLibraryProgress } from './library-progress'
import { LibrarySkeleton, SongsSkeleton } from './library-skeleton'
import { type LibraryFilters, libraryQuery, workerStatusQuery } from './queries'
import { RevisitList } from './revisit-list'
import { SongMedia } from './song-media'
import { cardStatus, isInProgress, type SongNeed, songNeed } from './song-status'
import { SongTile } from './song-tile'
import { WeekStrip } from './week-strip'

type Song = z.infer<typeof LibrarySong>
type Sort = z.infer<typeof LibrarySort>
type StatusFilter = z.infer<typeof LibraryStatusFilter>

export type LibrarySearch = LibraryFilters

const ALL = 'all'
/** From this many songs the list gets its toolbar: fewer fit on one screen with nothing to find. */
const TOOLBAR_FROM = 7

const GROUPS: { need: SongNeed; title: () => string }[] = [
  { need: 'getting_ready', title: () => m['library.group_getting_ready']() },
  { need: 'needs_you', title: () => m['library.group_needs_you']() },
  { need: 'ready', title: () => m['library.group_ready']() },
]

function sortLabel(sort: Sort): string {
  if (sort === 'added') return m['library.sort_added']()
  if (sort === 'title') return m['library.sort_title']()
  return m['library.sort_last_practised']()
}

function statusLabel(status: StatusFilter | undefined): string {
  switch (status) {
    case 'ready':
      return m['library.status.ready']()
    case 'partial':
      return m['library.status.partial']()
    case 'analysing':
      return m['library.filter_analysing']()
    case 'failed':
      return m['library.status.failed']()
    default:
      return m['library.filter_all']()
  }
}

// Library (27 §3.5): the page title, Continue (the last song's waveform with the place the learner
// stopped, and Resume practice, the page's one filled control), This week as one row across the
// page, Worth a revisit, then the songs as tiles, three across from 1024 px, two from 640 px and
// one on phones, grouped by what each song needs (Getting ready, Needs you, Ready to practise),
// 24 at a time, closing with the tile that adds the next song. The toolbar (instrument, title
// search, what to show and the sort, all in the URL and each naming its current value) appears
// once there is something to find: from seven songs, or while a filter is on (one row from 1280 px). The instrument
// choices are the instruments the library has. The progress parts read the practice progress
// (library-progress.tsx, s39).
export function LibraryPage({ search }: { search: LibrarySearch }) {
  const navigate = useNavigate({ from: '/library' })
  const openAddSong = useOpenAddSong()
  const online = useOnline()
  const wide = useMediaQuery('(min-width: 640px)')
  const songs = useInfiniteQuery({
    ...libraryQuery(search),
    // Rows of songs being analysed refresh themselves; the list catches status changes.
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.items.some((song) => isInProgress(cardStatus(song, false))),
      )
        ? 10_000
        : false,
  })
  // Continue follows the most recently opened song whatever the filters show (the unfiltered first
  // page: the same request when no filter is on).
  const recent = useInfiniteQuery({ ...libraryQuery({}), enabled: songs.isSuccess })
  const last = recent.data?.pages[0]?.items.find((song) => song.last_opened_at !== null)
  const progress = useLibraryProgress(last)
  const lead = last && progress.continueCard(last)
  const items = songs.data?.pages.flatMap((page) => page.items) ?? []
  const anyWaiting = items.some((song) => isInProgress(cardStatus(song, false)))
  const worker = useQuery({ ...workerStatusQuery, enabled: anyWaiting })
  const workerOffline = anyWaiting && worker.data?.online === false
  const uploads = useUploads((s) => s.items)
  const [query, setQuery] = useState(search.q ?? '')
  useEffect(() => setQuery(search.q ?? ''), [search.q])

  const setSearch = (patch: Partial<LibrarySearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true })

  const clearFilters = () => {
    setQuery('')
    void navigate({ search: { sort: search.sort }, replace: true })
  }

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === (search.q ?? '')) return
    const timer = setTimeout(() => setSearch({ q: trimmed || undefined }), 300)
    return () => clearTimeout(timer)
  })

  const filtered = Boolean(search.q || search.instrument || search.status)
  const count = items.length
  const empty = songs.isSuccess && count === 0 && !filtered

  if (songs.isPending && !filtered) return <LibrarySkeleton />

  const groups = GROUPS.map((group) => ({
    ...group,
    songs: items.filter(
      (song: Song) => songNeed(cardStatus(song, isUploading(uploads[song.id]))) === group.need,
    ),
  })).filter((group) => group.songs.length > 0)

  const tools = filtered || songs.hasNextPage === true || count >= TOOLBAR_FROM
  // Every instrument while more songs can still load or a filter hides some; otherwise the ones
  // the library has. One instrument alone is nothing to choose between.
  const present =
    filtered || songs.hasNextPage
      ? INSTRUMENTS
      : INSTRUMENTS.filter((value) => items.some((song) => song.instrument === value))
  const choices = present.length > 1 || search.instrument ? present : []

  // The tile that adds a song closes the whole list: not a page that has more to load, and not a
  // filtered view, which shows what was asked for.
  const closes = (index: number) => index === groups.length - 1 && !filtered && !songs.hasNextPage

  const instrument =
    choices.length === 0 ? null : wide ? (
      <ToggleGroup
        aria-label={m['library.filter_instrument']()}
        className="flex-wrap"
        value={[search.instrument ?? ALL]}
        onValueChange={(value) => {
          const next = value[0] as InstrumentName | typeof ALL | undefined
          if (next) setSearch({ instrument: next === ALL ? undefined : next })
        }}
      >
        {[ALL, ...choices].map((value) => (
          <ToggleGroupItem key={value} value={value} size="sm">
            {value === ALL ? m['library.filter_all']() : instrumentLabel(value as InstrumentName)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    ) : (
      <Select
        value={search.instrument ?? ALL}
        onValueChange={(value) =>
          setSearch({ instrument: value === ALL ? undefined : (value as InstrumentName) })
        }
      >
        <SelectTrigger aria-label={m['library.filter_instrument']()} className="min-w-0 flex-1">
          <SelectValue>
            {(value: string) =>
              value === ALL
                ? m['library.all_instruments']()
                : instrumentLabel(value as InstrumentName)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent aria-label={m['library.filter_instrument']()}>
          <SelectItem value={ALL}>{m['library.all_instruments']()}</SelectItem>
          {choices.map((value) => (
            <SelectItem key={value} value={value}>
              {instrumentLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )

  const showMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="quiet" size="sm" />}>
        {m['library.show']()}: {statusLabel(search.status)}
        <ChevronDownIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
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

  const sortMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="quiet" size="sm" />}>
        <span className="sr-only">{m['library.sort_by']()}: </span>
        {sortLabel(search.sort ?? 'last_practised')}
        <ChevronDownIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
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
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex flex-col gap-10 max-sm:gap-8">
      <h1 className="text-heading">{m['library.title']()}</h1>

      {workerOffline && <WorkerStatus online={false} text={m['analysis.queued_offline']()} />}

      {(lead || progress.week) && (
        <div className="flex flex-col gap-8">
          {last && lead && (
            <ContinueBlock
              song={lead.summary}
              media={<SongMedia lead song={last} bars={wide ? 96 : 48} />}
              chart={lead.chart}
              renderLink={({ className, children }) => (
                <Link
                  to="/songs/$songId/practice"
                  params={{ songId: last.id }}
                  className={className}
                >
                  {children}
                </Link>
              )}
            />
          )}
          {progress.week && <WeekStrip days={progress.week.days} stats={progress.week.stats} />}
        </div>
      )}

      {/* Phones keep the songs close to the top: no revisit rows (27 §3.5 Phone). */}
      {wide && progress.revisit.length > 0 && (
        <RevisitList
          clips={progress.revisit}
          renderLink={(clip) => {
            const target = progress.revisit.find((r) => r.id === clip.id)
            return (
              <Link
                to="/songs/$songId/practice"
                params={{ songId: target?.songId ?? '' }}
                search={{ loop: target?.loop, tab: 'progress' }}
              />
            )
          }}
        />
      )}

      {empty ? (
        <EmptyState
          className="animate-rise-in"
          icon={<MusicIcon aria-hidden />}
          title={m['library.empty']()}
          // A phone has no page to drop a file on, and no key caps at this width.
          description={wide ? m['library.empty_body']() : m['library.empty_body_phone']()}
          action={
            <Button
              variant="primary"
              size="lg"
              {...(wide ? { shortcut: ADD_SONG_KEY } : {})}
              aria-keyshortcuts={ADD_SONG_KEY}
              onClick={() => openAddSong()}
            >
              {m['nav.add_song']()}
            </Button>
          }
          secondaryAction={
            <Link to="/start" className={buttonVariants({ variant: 'quiet', size: 'lg' })}>
              {m['library.try_example']()}
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="songs-title" className="flex flex-col gap-5">
          <h2 id="songs-title" className="sr-only">
            {m['library.songs_heading']()}
          </h2>
          {/* biome-ignore lint/a11y/useSemanticElements: <search> is newer than the Safari 16.4 floor (24 §2) */}
          <div
            role="search"
            className={tools ? 'flex flex-col gap-3 xl:flex-row xl:items-center' : 'hidden'}
          >
            {wide && instrument}
            <div className="flex flex-wrap items-center gap-2 xl:ml-auto xl:flex-nowrap">
              <div className="relative min-w-0 flex-1 max-sm:basis-full sm:max-w-80 xl:w-60 xl:flex-none">
                <SearchIcon
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  aria-label={m['library.filter_title']()}
                  placeholder={m['library.filter_title']()}
                  className="pl-10"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              {!wide && instrument}
              <div className="flex items-center gap-1 sm:ml-auto">
                {filtered && count > 0 && (
                  <Button variant="quiet" size="sm" onClick={clearFilters}>
                    <XIcon aria-hidden />
                    {m['library.clear_filters']()}
                  </Button>
                )}
                {showMenu}
                {sortMenu}
              </div>
            </div>
          </div>

          {songs.isError && (
            <InlineError
              title={m['library.load_error']()}
              description={m['library.load_error_body']()}
              actions={<Button onClick={() => songs.refetch()}>{m['common.retry']()}</Button>}
            />
          )}

          {songs.isPending ? (
            <SongsSkeleton />
          ) : count === 0 && filtered ? (
            <EmptyState
              className="animate-rise-in"
              icon={<SearchXIcon aria-hidden />}
              title={m['library.no_results_title']()}
              description={m['library.no_results']()}
              action={<Button onClick={clearFilters}>{m['library.clear_filters']()}</Button>}
            />
          ) : (
            <div className="flex flex-col gap-10">
              {groups.map((group, index) => (
                <section
                  key={group.need}
                  aria-label={group.title()}
                  data-need={group.need}
                  className="flex flex-col gap-3"
                >
                  <header className="flex items-center gap-2">
                    <h3 className="text-label-sm text-muted-foreground">{group.title()}</h3>
                    <span className="text-caption text-faint-foreground tabular-nums">
                      {group.songs.length}
                    </span>
                  </header>
                  <ul className="m-0 grid list-none gap-x-6 gap-y-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {group.songs.map((song) => (
                      <SongTile
                        key={song.id}
                        song={song}
                        bars={48}
                        workerOffline={workerOffline}
                        unavailable={!online && cardStatus(song, false).kind !== 'ready'}
                      />
                    ))}
                    {closes(index) && <AddSongTile wide={wide} />}
                  </ul>
                </section>
              ))}
            </div>
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
