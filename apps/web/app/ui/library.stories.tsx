import type { Meta, StoryObj } from '@storybook/react-vite'
import { EllipsisIcon } from 'lucide-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu.tsx'
import { LONG_TITLE, SONGS } from './fixtures.ts'
import { Progress as ProgressBar, ProgressLabel } from './progress.tsx'
import { Skeleton } from './skeleton.tsx'
import { InstrumentTile, SongCard, SongRow, type SongSummary } from './song-card.tsx'
import { WaveformPreview } from './waveform-preview.tsx'

// Library entries (26 §12.2 SongCard / SongRow): the card for the grid, the row for phones and the
// list view, in both themes, with the stem tile, the More menu, the 28 px preview and progress.
const meta = { title: 'Kit/Library' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const ENTRIES: SongSummary[] = SONGS.map((song) => ({
  title: song.title,
  subtitle: ['artist' in song ? song.artist : undefined, song.instrument]
    .filter(Boolean)
    .join(' · '),
  status: song.status,
  meta: ['lastPractised' in song ? song.lastPractised : undefined]
    .concat('bestTempo' in song ? song.bestTempo : undefined)
    .filter(Boolean)
    .join(' · '),
  href: song.href,
}))

const PEAKS = Array.from({ length: 48 }, (_, n) =>
  Math.abs(0.3 + 0.7 * Math.sin(n * 0.9) * Math.cos(n * 0.23)),
)

const tileFor = (instrument: string, size: 'sm' | 'md' = 'md') =>
  instrument === 'Bass' ? (
    <InstrumentTile stem="bass" label="Bs" size={size} />
  ) : (
    <InstrumentTile stem="guitar" label="Gt" size={size} />
  )

const GRID = 'grid list-none grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3.5 p-0'

const Grid = () => (
  <ul className={GRID}>
    {ENTRIES.map((song, i) => (
      <li key={song.href}>
        <SongCard
          song={song}
          leading={tileFor(SONGS[i]?.instrument ?? '')}
          preview={
            <WaveformPreview peaks={PEAKS} label={`Waveform of ${song.title}`} className="h-7" />
          }
          className="h-full"
        />
      </li>
    ))}
  </ul>
)

const List = () => (
  <ul className="flex max-w-md list-none flex-col gap-0.5 p-0">
    {ENTRIES.map((song, i) => (
      <li key={song.href}>
        <SongRow song={song} leading={tileFor(SONGS[i]?.instrument ?? '')} />
      </li>
    ))}
  </ul>
)

export const Cards: Story = { render: Grid }
export const CardsDaylight: Story = { render: Grid, globals: { appearance: 'light' } }
export const Rows: Story = { render: List }
export const RowsDaylight: Story = { render: List, globals: { appearance: 'light' } }
export const IncreasedContrast: Story = { render: Grid, globals: { contrast: 'more' } }

export const LongTitle: Story = {
  render: Grid,
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByTitle(LONG_TITLE)
    const title = link.querySelector('h3') as HTMLElement
    await expect(title.scrollHeight).toBeGreaterThan(title.clientHeight - 1)
  },
}

export const FocusCard: Story = {
  render: Grid,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const link = within(canvasElement).getAllByRole('link')[0]
    await expect(link).toHaveFocus()
    // The ring is drawn on the link's ::after, which covers the whole card.
    await expect(link && getComputedStyle(link, '::after').outlineStyle).toBe('solid')
  },
}

// The tile is decorative and sits before the title; parts take their own stem colours (26 §4.4).
export const Tiles: Story = {
  render: Grid,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tiles = canvasElement.querySelectorAll<HTMLElement>('[data-slot=instrument-tile]')
    await expect(tiles).toHaveLength(ENTRIES.length)
    for (const tile of tiles) await expect(tile).toHaveAttribute('aria-hidden', 'true')
    const link = canvas.getByTitle('Wish You Were Here')
    const card = link.closest<HTMLElement>('[data-slot=song-card]') as HTMLElement
    const tile = card.querySelector('[data-slot=instrument-tile]') as HTMLElement
    await expect(tile.getBoundingClientRect().width).toBe(40)
    await expect(tile.getBoundingClientRect().right).toBeLessThanOrEqual(
      link.getBoundingClientRect().left,
    )
    const fills = new Set([...tiles].map((t) => getComputedStyle(t).backgroundColor))
    await expect(fills.size).toBeGreaterThan(1)
  },
}

// Cards are bordered, not lifted (26 §9), with 16 px corners.
export const CardBordered: Story = {
  render: Grid,
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>('[data-slot=song-card]') as HTMLElement
    await expect(getComputedStyle(card).boxShadow).toBe('none')
    await expect(getComputedStyle(card).borderTopWidth).toBe('1px')
    await expect(parseFloat(getComputedStyle(card).borderTopLeftRadius)).toBe(16)
  },
}

// Phone rows are at least 60 px tall (27 §3.5).
export const RowHeight: Story = {
  render: List,
  play: async ({ canvasElement }) => {
    for (const row of canvasElement.querySelectorAll<HTMLElement>('[data-slot=song-row]')) {
      await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(60)
    }
  },
}

export const Unavailable: Story = {
  render: () => (
    <ul className={GRID}>
      {ENTRIES.slice(0, 2).map((song, i) => (
        <li key={song.href}>
          <SongCard
            song={song}
            leading={tileFor(SONGS[i]?.instrument ?? '')}
            unavailable={i === 1 ? 'Needs connection' : undefined}
          />
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Needs connection')).toBeVisible()
  },
}

export const Loading: Story = {
  render: () => (
    <ul aria-busy="true" className={GRID}>
      {['a', 'b', 'c'].map((key) => (
        <li key={key} className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2 pt-0.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-5.5 w-2/3 rounded-full" />
        </li>
      ))}
    </ul>
  ),
}

function Menu({ title }: { title: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`More for ${title}`} />}
      >
        <EllipsisIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuItem>Analyse again</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Delete song</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const Progress = () => (
  <ProgressBar value={38}>
    <ProgressLabel className="font-normal text-faint-foreground tabular-nums">
      Isolating your part · about 2 min left
    </ProgressLabel>
  </ProgressBar>
)

const WithActions = ({ rows = false }: { rows?: boolean }) => (
  <ul className={rows ? 'flex max-w-md list-none flex-col gap-0.5 p-0' : GRID}>
    {ENTRIES.map((song, i) => {
      const Entry = rows ? SongRow : SongCard
      return (
        <li key={song.href}>
          <Entry
            song={song}
            leading={tileFor(SONGS[i]?.instrument ?? '', 'md')}
            actions={<Menu title={song.title} />}
            progress={i === 1 ? <Progress /> : undefined}
            className={rows ? undefined : 'h-full'}
          />
        </li>
      )
    })}
  </ul>
)

export const CardsWithMenu: Story = {
  render: () => <WithActions />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [first] = ENTRIES
    const trigger = canvas.getByRole('button', { name: `More for ${first?.title}` })
    await userEvent.click(trigger)
    const menu = await within(document.body).findByRole('menu')
    // The popup fades in; wait for it rather than sampling mid-animation.
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: 'Delete song' })).toBeVisible(),
    )
    await userEvent.keyboard('{Escape}')
  },
}
export const RowsWithMenu: Story = { render: () => <WithActions rows /> }
export const CardsWithMenuDaylight: Story = {
  render: () => <WithActions />,
  globals: { appearance: 'light' },
}
