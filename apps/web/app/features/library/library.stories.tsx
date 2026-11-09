import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { AppShell } from '../shell/app-shell'
import { analysis, LIBRARY, ME, STATS, WORKER_OFFLINE, WORKER_ONLINE } from '../story-fixtures'
import { LibraryPage, type LibrarySearch } from './library-page'
import { LibrarySkeleton } from './library-skeleton'
import { libraryQuery, statsQuery, workerStatusQuery } from './queries'
import { RevisitList } from './revisit-list'
import { WeekStrip, WeekStripCompact } from './week-strip'

// Library screen states (27 §3.5, §4; Library, Phone-Library, States): the Continue card and every
// card status, phone rows, empty, no results, loading, load error, offline and the worker-offline
// banner, in Night Rehearsal and Daylight; This week and Worth a revisit with fixture data (s39).
const meta = { title: 'Screens/Library', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const DAYLIGHT = { appearance: 'light' }

// Entries and empty states rise in (26 §10); wait for the entrance rather than sampling mid-way.
const settled = (element: HTMLElement) => waitFor(() => expect(element).toBeVisible())

function seed(songs = LIBRARY, worker = WORKER_ONLINE, filters: LibrarySearch = {}) {
  return (client: QueryClient) => {
    const pages = { pages: [{ items: songs, next_cursor: null }], pageParams: [undefined] }
    client.setQueryData(libraryQuery(filters).queryKey, pages)
    client.setQueryData(libraryQuery({}).queryKey, {
      pages: [{ items: filters.q || filters.instrument ? LIBRARY : songs, next_cursor: null }],
      pageParams: [undefined],
    })
    client.setQueryData(workerStatusQuery.queryKey, worker)
    client.setQueryData(statsQuery.queryKey, STATS)
    client.setQueryData(meQuery.queryKey, ME)
    for (const run of [analysis(2, 'running'), analysis(3, 'queued'), analysis(7, 'failed')]) {
      client.setQueryData(orpc.analyses.get.queryKey({ input: { id: run.id } }), run)
    }
  }
}

const Screen = ({ search = {} }: { search?: LibrarySearch }) => (
  <AppShell me={ME}>
    <LibraryPage search={search} />
  </AppShell>
)

const populated = () => (
  <AppStory path="/library" seed={seed()}>
    <Screen />
  </AppStory>
)

const playPopulated: Story['play'] = async ({ canvasElement }) => {
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
  // The Continue card: the most recently opened song is the page's h1 (27 §3.5, before s39).
  await expect(canvas.getByRole('heading', { level: 1, name: 'Riff in A minor' })).toBeVisible()
  await expect(canvas.getByText('Best clean 85 %')).toBeVisible()
  await expect(canvas.getByRole('link', { name: 'Resume practice' })).toHaveAttribute(
    'href',
    '/songs/00000000-0000-4000-8000-000000000001/practice',
  )
  await expect(canvas.getAllByText('You can loop it already').length).toBeGreaterThan(0)
  await expect(canvas.getByText('Add stems + tab with a Full analysis')).toBeVisible()
  await settled(await canvas.findByText(/Isolating your part · about \d+ min left/))
  // The analysing card's bar follows the list's stage count (3 of 8).
  await expect(canvas.getByRole('progressbar', { name: /Isolating your part/ })).toHaveAttribute(
    'aria-valuenow',
    '38',
  )
  const entries = canvasElement.querySelectorAll<HTMLElement>('li[data-vt-song]')
  await expect(entries).toHaveLength(8)
  await expect(entries[3]?.style.getPropertyValue('--i')).toBe('3')
  await expect(canvasElement.querySelectorAll('[data-slot=instrument-tile]')).toHaveLength(8)
  await settled(await canvas.findByText("This didn't use an analysis."))
  // One primary per view (26 §4.5): Add song in the bar has the amber fill Resume practice lacks.
  const fill = (el: HTMLElement) => getComputedStyle(el).backgroundColor
  const addSong = canvas.getByRole('button', { name: 'Add song' })
  await expect(fill(canvas.getByRole('link', { name: 'Resume practice' }))).not.toBe(fill(addSong))
}

export const Populated: Story = { render: populated, play: playPopulated }
export const PopulatedDaylight: Story = {
  render: populated,
  play: playPopulated,
  globals: DAYLIGHT,
}

const playPhone: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await settled(await canvas.findByText('Analysing 3/8'))
  // Phone-Library: the compact Continue card is one link; entries are rows of at least 60 px.
  await expect(canvas.getByRole('link', { name: /Pick up where you left off/ })).toBeVisible()
  const rows = canvasElement.querySelectorAll<HTMLElement>('[data-slot=song-row]')
  await expect(rows).toHaveLength(8)
  for (const row of rows) await expect(row.getBoundingClientRect().height).toBeGreaterThan(59)
  await expect(canvas.getByRole('group', { name: 'Instrument' })).toBeVisible()
}
export const PopulatedPhone: Story = { render: populated, play: playPhone, globals: PHONE }
export const PopulatedPhoneDaylight: Story = {
  render: populated,
  play: playPhone,
  globals: { ...PHONE, ...DAYLIGHT },
}

export const PopulatedList: Story = {
  render: () => (
    <AppStory path="/library?view=list" seed={seed()}>
      <Screen search={{ view: 'list' }} />
    </AppStory>
  ),
}

// The filters come from the router here, so chips, the menu and Grid/List navigate like the app: a
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
    const view = await canvas.findByRole('group', { name: 'View' })
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

// Instrument chips and the sort and status menu write the URL (27 §3.5).
export const Filters: Story = {
  render: () => (
    <AppStory path="/library" seed={seed()}>
      <RoutedScreen />
      <SearchProbe />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chips = await canvas.findByRole('group', { name: 'Instrument' })
    await expect(within(chips).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(within(chips).getByRole('button', { name: 'Bass' }))
    await waitFor(() => expect(canvas.getByTestId('search').textContent).toContain('"bass"'))
    await userEvent.click(canvas.getByRole('button', { name: /Sort and show/ }))
    const menu = within(await within(document.body).findByRole('menu'))
    await userEvent.click(await menu.findByRole('menuitemradio', { name: 'Title' }))
    await waitFor(() => expect(canvas.getByTestId('search').textContent).toContain('"title"'))
  },
}

function SearchProbe() {
  const search = useRouterState({ select: (state) => state.location.search })
  return (
    <output data-testid="search" hidden>
      {JSON.stringify(search)}
    </output>
  )
}

export const WorkerOffline: Story = {
  render: () => (
    <AppStory path="/library" seed={seed(LIBRARY, WORKER_OFFLINE)}>
      <Screen />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(
        'Processing machine offline. Your song is queued and starts automatically.',
      ),
    ).toBeVisible()
    await settled(canvas.getByText('Processing machine offline. Starts automatically.'))
  },
}

const empty = () => (
  <AppStory path="/library" seed={seed([])}>
    <Screen />
  </AppStory>
)
const playEmpty: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await settled(
    await canvas.findByRole('heading', { name: 'Bring the first song you want to learn' }),
  )
  await expect(
    canvas.getByText('Drop a file anywhere on this page, paste a link, or record it.'),
  ).toBeVisible()
  await expect(canvas.getByRole('link', { name: 'Try an example' })).toHaveAttribute(
    'href',
    '/start',
  )
}
export const Empty: Story = { render: empty, play: playEmpty }
export const EmptyDaylight: Story = { render: empty, play: playEmpty, globals: DAYLIGHT }
export const EmptyPhone: Story = { render: empty, play: playEmpty, globals: PHONE }

export const NoResults: Story = {
  render: () => (
    <AppStory path="/library?q=zzz" seed={seed([], WORKER_ONLINE, { q: 'zzz' })}>
      <Screen search={{ q: 'zzz' }} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await settled(await canvas.findByText('No songs match. Try another search or filter.'))
    await expect(canvas.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0)
  },
}

const loading = () => (
  <AppStory path="/library">
    <AppShell me={ME}>
      <LibrarySkeleton />
    </AppShell>
  </AppStory>
)
export const Loading: Story = { render: loading }
export const LoadingDaylight: Story = { render: loading, globals: DAYLIGHT }

// Nothing seeded: the list request fails against Storybook's server.
export const LoadError: Story = {
  render: () => (
    <AppStory path="/library" seed={(client) => client.setQueryData(meQuery.queryKey, ME)}>
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

// Offline (27 §4): cached cards stay; the ones that need the server are dimmed.
const goOffline = () => {
  const online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')
  Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false })
  return () => {
    if (online) Object.defineProperty(Navigator.prototype, 'onLine', online)
  }
}
export const Offline: Story = {
  render: populated,
  beforeEach: goOffline,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await settled((await canvas.findAllByText('Needs connection'))[0] as HTMLElement)
    await expect(canvasElement.querySelectorAll('[data-unavailable]').length).toBeGreaterThan(0)
  },
}

// This week and Worth a revisit wait for progress data (s39): their layouts with fixture data.
const WEEK = [
  { letter: 'M', minutes: 0 },
  { letter: 'T', minutes: 18 },
  { letter: 'W', minutes: 0 },
  { letter: 'T', minutes: 31 },
  { letter: 'F', minutes: 7 },
  { letter: 'S', minutes: 0 },
  { letter: 'S', minutes: 24 },
]
const CLIPS = [
  {
    id: 'c1',
    instrument: 'guitar' as const,
    clip: 'Bridge bends',
    meta: 'Northbound Lights · 6 days ago · best 65 %',
  },
  {
    id: 'c2',
    instrument: 'bass' as const,
    clip: 'Walking line',
    meta: 'Low Tide Waltz · 9 days ago · best 90 %',
  },
  {
    id: 'c3',
    instrument: 'piano' as const,
    clip: 'Left hand intro',
    meta: 'Copper Sky · 12 days ago · best 55 %',
  },
]
const progressSections = () => (
  <AppStory>
    <div className="flex max-w-library flex-col gap-7 p-6">
      <WeekStrip
        days={WEEK}
        stats={[
          { value: '1 h 20', label: 'practised' },
          { value: '23', label: 'clean passes' },
          { value: '+10 %', label: 'on Chorus riff' },
        ]}
        className="max-w-sm"
      />
      <WeekStripCompact days={WEEK} total="1 h 20" />
      <RevisitList
        clips={CLIPS}
        renderLink={({ clip: _clip, ...props }) => <a href="#clip" {...props} />}
      />
    </div>
  </AppStory>
)
const playProgress: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(
    canvas.getAllByRole('img', { name: 'Practised on 4 of the last 7 days' }),
  ).toHaveLength(2)
  await expect(canvas.getByRole('heading', { name: 'Worth a revisit' })).toBeVisible()
  await expect(canvas.getAllByRole('link')).toHaveLength(3)
}
export const ProgressSections: Story = { render: progressSections, play: playProgress }
export const ProgressSectionsDaylight: Story = {
  render: progressSections,
  play: playProgress,
  globals: DAYLIGHT,
}
