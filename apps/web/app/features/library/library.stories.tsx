import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { AppStory } from '../../../.storybook/app.tsx'
import { AppShell } from '../shell/app-shell'
import { analysis, LIBRARY, ME, STATS, WORKER_OFFLINE, WORKER_ONLINE } from '../story-fixtures'
import { LibraryPage, type LibrarySearch } from './library-page'
import { LibrarySkeleton } from './library-skeleton'
import { libraryQuery, statsQuery, workerStatusQuery } from './queries'

// Library screen states (27 §3.5, §4): populated with every card status, empty, no results,
// loading, error, and the worker-offline banner.
const meta = { title: 'Screens/Library', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

// Entries and empty states rise in (26 §10); wait for the entrance rather than sampling mid-way.
const settled = (element: HTMLElement) => waitFor(() => expect(element).toBeVisible())

function seed(songs = LIBRARY, worker = WORKER_ONLINE, filters = {}) {
  return (client: QueryClient) => {
    client.setQueryData(libraryQuery(filters).queryKey, {
      pages: [{ items: songs, next_cursor: null }],
      pageParams: [undefined],
    })
    client.setQueryData(workerStatusQuery.queryKey, worker)
    client.setQueryData(statsQuery.queryKey, STATS)
    for (const run of [analysis(2, 'running'), analysis(3, 'queued'), analysis(7, 'failed')]) {
      client.setQueryData(orpc.analyses.get.queryKey({ input: { id: run.id } }), run)
    }
  }
}

const Screen = ({ search = {} }: { search?: Parameters<typeof LibraryPage>[0]['search'] }) => (
  <AppShell me={ME}>
    <LibraryPage me={ME} search={search} />
  </AppShell>
)

const populated = () => (
  <AppStory path="/library" seed={seed()}>
    <Screen />
  </AppStory>
)

export const Populated: Story = {
  render: populated,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const label of [
      'Ready',
      'Analysing 3/8',
      'Queued',
      'Chords only',
      'Partial',
      'Stems expired',
      'Failed',
    ]) {
      await settled(await canvas.findByText(label))
    }
    await settled(await canvas.findByText('Best 85 % on bars 17–20'))
    await settled(await canvas.findByText(/Isolating your part · About \d+ min left/))
    // The analysing card's bar follows the list's stage count (3 of 8).
    await expect(canvas.getByRole('progressbar', { name: /Isolating your part/ })).toHaveAttribute(
      'aria-valuenow',
      '38',
    )
    // Every entry carries its instrument tile, and entries rise in one after another.
    const entries = canvasElement.querySelectorAll<HTMLElement>('li[data-vt-song]')
    await expect(entries).toHaveLength(8)
    await expect(entries[3]?.style.getPropertyValue('--i')).toBe('3')
    await expect(canvasElement.querySelectorAll('[data-slot=instrument-tile]')).toHaveLength(8)
    await settled(await canvas.findByText("This didn't use an analysis."))
  },
}

// The view comes from the router here, so the grid/list switch navigates like the app: a
// library-reorder view transition morphs each card into its row while the capsule slides.
function RoutedScreen() {
  const search = useRouterState({ select: (state) => state.location.search as LibrarySearch })
  return <Screen search={search} />
}

export const ViewSwitch: Story = {
  render: () => (
    <AppStory path="/library" seed={seed()}>
      <RoutedScreen />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const view = canvas.getByRole('group', { name: 'View' })
    const list = within(view).getByRole('button', { name: 'List' })
    const capsule = () => view.querySelector<HTMLElement>('[data-slot="toggle-group-capsule"]')
    await waitFor(() => expect(capsule()).not.toBeNull())
    await userEvent.click(list)
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot=song-row]')).toHaveLength(8),
    )
    await expect(list).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() =>
      expect(capsule()?.style.translate).toBe(`${list.offsetLeft}px ${list.offsetTop}px`),
    )
    await userEvent.click(within(view).getByRole('button', { name: 'Grid' }))
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot=song-card]')).toHaveLength(8),
    )
  },
}

export const PopulatedList: Story = {
  render: () => (
    <AppStory path="/library?view=list" seed={seed()}>
      <Screen search={{ view: 'list' }} />
    </AppStory>
  ),
}

export const PopulatedDark: Story = { render: populated, globals: { appearance: 'dark' } }
export const PopulatedStage: Story = { render: populated, globals: { appearance: 'stage' } }

export const WorkerOffline: Story = {
  render: () => (
    <AppStory path="/library" seed={seed(LIBRARY, WORKER_OFFLINE)}>
      <Screen />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/Processing machine offline — your song is queued/),
    ).toBeVisible()
  },
}

export const Empty: Story = {
  render: () => (
    <AppStory path="/library" seed={seed([])}>
      <Screen />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await settled(await canvas.findByText(/Your library is empty/))
    await settled(canvas.getByRole('link', { name: 'Import a song' }))
  },
}

export const NoResults: Story = {
  render: () => (
    <AppStory path="/library?q=zzz" seed={seed([], WORKER_ONLINE, { q: 'zzz' })}>
      <Screen search={{ q: 'zzz' }} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    await settled(await within(canvasElement).findByRole('button', { name: 'Clear filters' }))
  },
}

export const Loading: Story = {
  render: () => (
    <AppStory path="/library">
      <AppShell me={ME}>
        <LibrarySkeleton />
      </AppShell>
    </AppStory>
  ),
}

// Nothing seeded: the list request fails against Storybook's server.
export const LoadError: Story = {
  render: () => (
    <AppStory path="/library">
      <Screen />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The failing request goes to Storybook's server; give it time under a busy test run.
    await expect(
      await canvas.findByText("We couldn't load your library.", undefined, { timeout: 5_000 }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible()
  },
}
