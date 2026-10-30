import type { Meta, StoryObj } from '@storybook/react-vite'
import { EllipsisVerticalIcon, GuitarIcon } from 'lucide-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu.tsx'
import { LONG_TITLE, SONGS } from './fixtures.ts'
import { BassIcon } from './icons/bass.tsx'
import { Progress as ProgressBar, ProgressLabel } from './progress.tsx'
import { Skeleton } from './skeleton.tsx'
import { InstrumentTile, SongCard, SongRow } from './song-card.tsx'

const meta = { title: 'Kit/Library' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const Grid = () => (
  <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4 p-0">
    {SONGS.map((song) => (
      <li key={song.href}>
        <SongCard song={song} className="h-full" />
      </li>
    ))}
  </ul>
)

const LIST =
  'list-none divide-y divide-border overflow-hidden rounded-2xl bg-surface-raised p-0 shadow-1'

const tileFor = (instrument: string, size: 'sm' | 'md' = 'md') =>
  instrument === 'Bass' ? (
    <InstrumentTile stem="bass" icon={<BassIcon />} size={size} />
  ) : (
    <InstrumentTile stem="guitar" icon={<GuitarIcon />} size={size} />
  )

const List = () => (
  <ul className={`max-w-md ${LIST}`}>
    {SONGS.map((song) => (
      <li key={song.href}>
        <SongRow song={song} />
      </li>
    ))}
  </ul>
)

export const Cards: Story = { render: Grid }
export const Rows: Story = { render: List }

export const LongTitle: Story = {
  render: Grid,
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: LONG_TITLE })
    await expect(link).toHaveAttribute('title', LONG_TITLE)
    await expect(link.scrollHeight).toBeGreaterThan(link.clientHeight - 1)
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

export const Loading: Story = {
  render: () => (
    <ul
      aria-busy="true"
      className="grid list-none grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4 p-0"
    >
      {['a', 'b', 'c'].map((key) => (
        <li key={key} className="flex flex-col gap-4 rounded-2xl bg-surface-raised p-4 shadow-1">
          <div className="flex items-start gap-3">
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-4 w-2/3" />
        </li>
      ))}
    </ul>
  ),
}

const WithLeading = () => (
  <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4 p-0">
    {SONGS.map((song) => (
      <li key={song.href}>
        <SongCard song={song} className="h-full" leading={tileFor(song.instrument)} />
      </li>
    ))}
  </ul>
)

export const CardsWithLeading: Story = {
  render: WithLeading,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tiles = canvasElement.querySelectorAll<HTMLElement>('[data-slot=instrument-tile]')
    await expect(tiles).toHaveLength(SONGS.length)
    // The tile is decorative: the instrument is named in text beside it.
    for (const tile of tiles) await expect(tile).toHaveAttribute('aria-hidden', 'true')
    // The title is still the one link, and the tile sits before the text.
    const link = canvas.getByRole('link', { name: 'Wish You Were Here' })
    const card = link.closest<HTMLElement>('[data-slot=song-card]') as HTMLElement
    const tile = card.querySelector('[data-slot=instrument-tile]') as HTMLElement
    await expect(tile.getBoundingClientRect().right).toBeLessThanOrEqual(
      link.getBoundingClientRect().left,
    )
    // Bass and guitar take their own stem colours (26 §4.4).
    const colours = new Set([...tiles].map((t) => getComputedStyle(t).color))
    await expect(colours.size).toBeGreaterThan(1)
  },
}
export const CardsWithLeadingDark: Story = { render: WithLeading, globals: { appearance: 'dark' } }
export const CardsWithLeadingStage: Story = {
  render: WithLeading,
  globals: { appearance: 'stage' },
}

export const CardRaised: Story = {
  render: Grid,
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>('[data-slot=song-card]') as HTMLElement
    // Without a leading slot the title column starts the card's header row.
    await expect(card.querySelector('[data-slot=instrument-tile]')).toBeNull()
    await expect(card.firstElementChild?.firstElementChild?.querySelector('a')).not.toBeNull()
    await expect(getComputedStyle(card).boxShadow).not.toBe('none')
    await expect(parseFloat(getComputedStyle(card).borderTopLeftRadius)).toBeGreaterThan(12)
  },
}

export const Dark: Story = { render: Grid, globals: { appearance: 'dark' } }
export const Stage: Story = { render: Grid, globals: { appearance: 'stage' } }
export const RowsDark: Story = { render: List, globals: { appearance: 'dark' } }
export const IncreasedContrast: Story = { render: Grid, globals: { contrast: 'more' } }

const RowsLeading = () => (
  <ul className={LIST}>
    {SONGS.map((song) => (
      <li key={song.href}>
        <SongRow song={song} leading={tileFor(song.instrument, 'sm')} />
      </li>
    ))}
  </ul>
)

export const RowsWithLeading: Story = { render: RowsLeading }
export const RowsWithLeadingDark: Story = { render: RowsLeading, globals: { appearance: 'dark' } }

// Practice stats sit on the card's bottom edge, so cards of different heights in a grid row line up.
export const StatsAtBottom: Story = {
  render: () => (
    <ul className="grid list-none grid-cols-2 gap-4 p-0">
      {SONGS.slice(0, 2).map((song, i) => (
        <li key={song.href}>
          <SongCard
            song={{ ...song, lastPractised: 'Practised today' }}
            progress={i === 0 ? <Progress /> : undefined}
            className="h-full"
          />
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    const stats = within(canvasElement).getAllByText('Practised today')
    const [a, b] = stats.map((el) => el.getBoundingClientRect().bottom)
    await expect(Math.abs((a ?? 0) - (b ?? 0))).toBeLessThan(1)
  },
}

function Menu({ title }: { title: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={`More for ${title}`} />}
      >
        <EllipsisVerticalIcon aria-hidden />
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
    <ProgressLabel className="font-normal text-muted-foreground tabular-nums">
      Isolating your part · About 2 min left
    </ProgressLabel>
  </ProgressBar>
)

const WithActions = ({ rows = false }: { rows?: boolean }) => (
  <ul
    className={
      rows
        ? `max-w-md ${LIST}`
        : 'grid list-none grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4 p-0'
    }
  >
    {SONGS.map((song, i) => {
      const Entry = rows ? SongRow : SongCard
      return (
        <li key={song.href}>
          <Entry
            song={song}
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
    const [first] = SONGS
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
export const CardsWithMenuDark: Story = {
  render: () => <WithActions />,
  globals: { appearance: 'dark' },
}
