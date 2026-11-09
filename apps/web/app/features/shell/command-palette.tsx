import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import type { LibrarySong } from '@splitune/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  KeyboardIcon,
  LogOutIcon,
  MonitorSmartphoneIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  TypeIcon,
} from 'lucide-react'
import type * as React from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { z } from 'zod'
import { orpc } from '@/lib/api'
import { appearanceLabel } from '@/lib/appearance'
import { useDisplay } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent } from '@/ui/dialog'
import { Kbd } from '@/ui/kbd'
import { useOpenAddSong } from '../import/add-song-state'
import { SongTile } from '../library/song-tile'
import { APPEARANCES } from './account-menu'
import { type PaletteAction, usePalette } from './palette-store'
import { useSignOut } from './use-sign-out'

type Song = z.infer<typeof LibrarySong>
type Row = PaletteAction & { group: 'songs' | 'clips' | 'actions'; tile?: React.ReactNode }

const SONG_LIMIT = 5

type SettingsPath = `/settings/${'profile' | 'billing' | 'privacy' | 'display' | 'keyboard'}`

const APPEARANCE_ICON = { dark: MoonIcon, light: SunIcon, system: MonitorSmartphoneIcon }

/** The typed text bold in a result (27 §3.12), matched case-insensitively. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-bold">{text.slice(at, at + query.length)}</strong>
      {text.slice(at + query.length)}
    </>
  )
}

const matches = (action: PaletteAction, query: string) => {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return true
  return [action.label, ...(action.keywords ?? [])].some((text) =>
    text.toLocaleLowerCase().includes(q),
  )
}

/** Every song in the cached library pages, newest query first, without repeats (offline). */
function cachedSongs(client: ReturnType<typeof useQueryClient>): Song[] {
  const seen = new Map<string, Song>()
  for (const [, data] of client.getQueriesData<{ pages?: { items: Song[] }[] }>({
    queryKey: orpc.songs.list.key(),
  })) {
    for (const page of data?.pages ?? []) for (const song of page.items) seen.set(song.id, song)
  }
  return [...seen.values()]
}

// Command palette (27 §3.12, 26 §12.2): a dialog with the 52 px search field and results grouped
// Songs, Clips and Actions; ↑/↓ move, Enter runs, the selected row shows its Enter key. Songs come
// from the library search, or from the cache when offline. Clips and practice actions are the ones
// the current screen registered (`usePaletteActions`).
export default function CommandPalette() {
  const setOpen = usePalette((s) => s.setOpen)
  const registered = usePalette((s) => s.registered)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const online = useOnline()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const openAddSong = useOpenAddSong()
  const signOut = useSignOut()
  const update = useDisplay((s) => s.update)
  const listId = useId()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 150)
    return () => clearTimeout(timer)
  }, [query])

  const search = useQuery({
    ...orpc.songs.list.queryOptions({
      input: { limit: SONG_LIMIT, ...(debounced ? { q: debounced } : {}) },
    }),
    enabled: online,
    placeholderData: (previous) => previous,
  })

  const songs = useMemo(() => {
    // Results only ever show songs whose title holds the text typed, also while the next search
    // loads; offline, or when the search fails, they come from the cache (27 §4).
    const q = debounced.toLocaleLowerCase()
    const source = online && search.data ? search.data.items : cachedSongs(queryClient)
    return source
      .filter((song) => !q || song.title.toLocaleLowerCase().includes(q))
      .slice(0, SONG_LIMIT)
  }, [online, search.data, debounced, queryClient])

  const close = () => setOpen(false)
  const go = (to: SettingsPath) => () => void navigate({ to })

  const builtIn: PaletteAction[] = [
    {
      id: 'add-song',
      label: m['nav.add_song'](),
      icon: <PlusIcon aria-hidden />,
      run: () => openAddSong(),
    },
    ...APPEARANCES.map((choice) => {
      const Icon = APPEARANCE_ICON[choice as keyof typeof APPEARANCE_ICON]
      return {
        id: `appearance-${choice}`,
        label: m['nav.appearance_choice']({ choice: appearanceLabel(choice) }),
        keywords: [m['nav.appearance']()],
        icon: <Icon aria-hidden />,
        run: () => update({ appearance: choice }),
      }
    }),
    {
      id: 'pedal',
      label: m['nav.set_up_pedal'](),
      icon: <KeyboardIcon aria-hidden />,
      run: go('/settings/keyboard'),
    },
    {
      id: 'display',
      label: m['nav.display_reading'](),
      icon: <TypeIcon aria-hidden />,
      run: go('/settings/display'),
    },
    ...(
      [
        ['profile', m['settings.profile']()],
        ['billing', m['settings.billing']()],
        ['privacy', m['settings.privacy']()],
        ['display', m['settings.display']()],
        ['keyboard', m['settings.keyboard']()],
      ] as const
    ).map(([section, name]) => ({
      id: `settings-${section}`,
      label: m['nav.settings_section']({ section: name }),
      keywords: [m['nav.settings']()],
      icon: <SettingsIcon aria-hidden />,
      run: go(`/settings/${section}`),
    })),
    {
      id: 'sign-out',
      label: m['nav.sign_out'](),
      icon: <LogOutIcon aria-hidden />,
      run: () => void signOut(),
    },
  ]

  const rows: Row[] = []
  for (const song of songs) {
    rows.push({
      group: 'songs',
      id: `song-${song.id}`,
      label: song.title,
      context: [song.artist, instrumentLabel(song.instrument)].filter(Boolean).join(' · '),
      tile: <SongTile instrument={song.instrument} size="sm" />,
      run: () => void navigate({ to: '/songs/$songId/practice', params: { songId: song.id } }),
    })
  }
  const screen = Object.values(registered)
  for (const group of ['clips', 'actions'] as const) {
    const actions = [
      ...screen.filter((r) => r.group === group).flatMap((r) => r.actions),
      ...(group === 'actions' ? builtIn : []),
    ]
    for (const action of actions) {
      const parsed = action.parse?.(query)
      if (parsed) rows.push({ ...action, ...parsed, id: `${action.id}-parsed`, group })
      else if (!action.parse && matches(action, query)) rows.push({ ...action, group })
    }
  }

  const selected = Math.min(active, Math.max(0, rows.length - 1))
  const run = (row: Row | undefined) => {
    if (!row) return
    close()
    row.run()
  }

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((rows.length + selected + step) % Math.max(1, rows.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(rows[selected])
    }
  }

  const heading = {
    songs: m['nav.palette_songs'](),
    clips: m['nav.palette_clips'](),
    actions: m['nav.palette_actions'](),
  }
  const optionId = (index: number) => `${listId}-${index}`

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        data-slot="command-palette"
        className="top-[12dvh] translate-y-0 gap-0 p-2 sm:max-w-170"
      >
        <DialogPrimitive.Title className="sr-only">{m['nav.search']()}</DialogPrimitive.Title>
        <div className="flex h-13 items-center gap-2.5 border-b border-border px-3">
          <SearchIcon aria-hidden className="size-5 shrink-0 text-faint-foreground" />
          <input
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={rows.length > 0 ? optionId(selected) : undefined}
            aria-label={m['nav.search']()}
            placeholder={m['nav.search']()}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 self-stretch bg-transparent text-lg font-normal text-foreground focus-visible:outline-offset-2 placeholder:text-faint-foreground"
          />
          <Kbd aria-hidden>{m['nav.key_escape']()}</Kbd>
        </div>
        {rows.length === 0 && (
          <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
            {m['nav.palette_empty']()}
          </p>
        )}
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={m['nav.search']()}
          className={cn(
            'flex max-h-[min(60dvh,28rem)] flex-col overflow-y-auto py-1',
            rows.length === 0 && 'hidden',
          )}
        >
          {(['songs', 'clips', 'actions'] as const).map((group) => {
            const inGroup = rows.flatMap((row, index) =>
              row.group === group ? [{ row, index }] : [],
            )
            if (inGroup.length === 0) return null
            return (
              // biome-ignore lint/a11y/useSemanticElements: a listbox group, not a form fieldset
              <div key={group} role="group" aria-labelledby={`${listId}-${group}`}>
                <p
                  role="presentation"
                  id={`${listId}-${group}`}
                  className="px-3 pt-2.5 pb-1 text-sm text-faint-foreground"
                >
                  {heading[group]}
                  {group === 'songs' && !online && ` · ${m['nav.palette_offline']()}`}
                </p>
                {inGroup.map(({ row, index }) => (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: the combobox field handles the keys
                  <div
                    key={row.id}
                    id={optionId(index)}
                    data-index={index}
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === selected}
                    onMouseMove={() => index !== selected && setActive(index)}
                    onClick={() => run(row)}
                    className={cn(
                      'flex min-h-target cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-base aria-selected:bg-muted forced-colors:aria-selected:outline-2 forced-colors:aria-selected:outline-solid [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-faint-foreground',
                    )}
                  >
                    {row.tile ?? row.icon}
                    <span className="min-w-0 flex-1 truncate">
                      <Highlight text={row.label} query={row.parse ? '' : query.trim()} />
                      {row.context && (
                        <span className="text-faint-foreground"> · {row.context}</span>
                      )}
                    </span>
                    {row.kbd && <Kbd aria-hidden>{row.kbd}</Kbd>}
                    {index === selected && <Kbd aria-hidden>{m['nav.key_enter']()}</Kbd>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
