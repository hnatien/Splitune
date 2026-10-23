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
import { Skeleton } from './skeleton.tsx'
import { SongCard, SongRow } from './song-card.tsx'

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

const List = () => (
  <ul className="max-w-md list-none rounded-xl border border-border bg-card p-0">
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
        <li key={key} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-1/2" />
        </li>
      ))}
    </ul>
  ),
}

const WithLeading = () => (
  <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4 p-0">
    {SONGS.map((song) => (
      <li key={song.href}>
        <SongCard
          song={song}
          className="h-full"
          leading={
            <span
              data-testid="instrument-tile"
              className="grid size-12 place-items-center rounded-xl bg-surface-sunken text-primary [&_svg]:size-6"
            >
              {song.instrument === 'Bass' ? <BassIcon aria-hidden /> : <GuitarIcon aria-hidden />}
            </span>
          }
        />
      </li>
    ))}
  </ul>
)

export const CardsWithLeading: Story = {
  render: WithLeading,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByTestId('instrument-tile')).toHaveLength(SONGS.length)
    // The title is still the one link, and the tile sits before the text.
    const link = canvas.getByRole('link', { name: 'Wish You Were Here' })
    const card = link.closest<HTMLElement>('[data-slot=song-card]') as HTMLElement
    const tile = within(card).getByTestId('instrument-tile')
    await expect(tile.getBoundingClientRect().right).toBeLessThanOrEqual(
      link.getBoundingClientRect().left,
    )
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
    // Without a leading slot the layout is the text column alone.
    await expect(card.querySelector('[data-testid=instrument-tile]')).toBeNull()
    await expect(card.children).toHaveLength(1)
    await expect(getComputedStyle(card).boxShadow).not.toBe('none')
    await expect(parseFloat(getComputedStyle(card).borderTopLeftRadius)).toBeGreaterThan(12)
  },
}

export const Dark: Story = { render: Grid, globals: { appearance: 'dark' } }
export const Stage: Story = { render: Grid, globals: { appearance: 'stage' } }
export const RowsDark: Story = { render: List, globals: { appearance: 'dark' } }
export const IncreasedContrast: Story = { render: Grid, globals: { contrast: 'more' } }

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
  <p className="text-sm text-muted-foreground tabular-nums">
    Isolating your part · About 2 min left
  </p>
)

const WithActions = ({ rows = false }: { rows?: boolean }) => (
  <ul
    className={
      rows
        ? 'max-w-md list-none rounded-xl border border-border bg-card p-0'
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
