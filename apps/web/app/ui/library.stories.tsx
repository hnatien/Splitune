import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { LONG_TITLE, SONGS } from './fixtures.ts'
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

export const Dark: Story = { render: Grid, globals: { appearance: 'dark' } }
export const Stage: Story = { render: Grid, globals: { appearance: 'stage' } }
export const RowsDark: Story = { render: List, globals: { appearance: 'dark' } }
export const IncreasedContrast: Story = { render: Grid, globals: { contrast: 'more' } }
