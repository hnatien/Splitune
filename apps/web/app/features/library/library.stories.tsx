import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { AppStory } from '../../../.storybook/app.tsx'
import { AppShell } from '../shell/app-shell'
import { analysis, LIBRARY, ME, STATS, WORKER_OFFLINE, WORKER_ONLINE } from '../story-fixtures'
import { LibraryPage } from './library-page'
import { LibrarySkeleton } from './library-skeleton'
import { libraryQuery, statsQuery, workerStatusQuery } from './queries'

// Library screen states (27 §3.5, §4): populated with every card status, empty, no results,
// loading, error, and the worker-offline banner.
const meta = { title: 'Screens/Library', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

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
      await expect(await canvas.findByText(label)).toBeVisible()
    }
    await expect(await canvas.findByText('Best 85 % on bars 17–20')).toBeVisible()
    await expect(await canvas.findByText(/Isolating your part · About \d+ min left/)).toBeVisible()
    await expect(await canvas.findByText("This didn't use an analysis.")).toBeVisible()
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
    await expect(await canvas.findByText(/Your library is empty/)).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Import a song' })).toBeVisible()
  },
}

export const NoResults: Story = {
  render: () => (
    <AppStory path="/library?q=zzz" seed={seed([], WORKER_ONLINE, { q: 'zzz' })}>
      <Screen search={{ q: 'zzz' }} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('button', { name: 'Clear filters' }),
    ).toBeVisible()
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
