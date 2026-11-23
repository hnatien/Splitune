import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { meQuery } from '@/lib/session'
import { expectTargets } from '@/ui/story-kit'
import { AppStory } from '../../../.storybook/app.tsx'
import { memoryOutbox } from '../practice/model/outbox-memory'
import { configurePracticeSync } from '../practice/model/practice-sync'
import { progressQuery } from '../practice/progress-data'
import { climb, type StorySession, storyProgress } from '../practice/progress-story-data'
import { AppShell } from '../shell/app-shell'
import {
  analysis,
  detail,
  LIBRARY,
  ME,
  STATS,
  WORKER_OFFLINE,
  WORKER_ONLINE,
} from '../story-fixtures'
import { LibraryPage, type LibrarySearch } from './library-page'
import { LibrarySkeleton } from './library-skeleton'
import { libraryQuery, statsQuery, workerStatusQuery } from './queries'
import { RevisitList } from './revisit-list'
import { WeekStrip } from './week-strip'

// Library screen states (s47 direction §6, 27 §3.5, §4): the Continue block with its clip, notes
// and sparkline beside This week, Worth a revisit, and the songs as hairline rows grouped by what
// each needs, every status a glyph and words; phone and tablet rows, empty, no results, loading,
// load error, offline and the worker-offline line, in Dark and Light.
const meta = {
  title: 'Screens/Library',
  parameters: { layout: 'fullscreen' },
  // Progress reads the practice outbox: an empty one per story, not what other stories left.
  beforeEach: () => configurePracticeSync({ db: memoryOutbox() }),
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const TABLET = { viewport: { value: 'tablet', isRotated: false } }
const DAYLIGHT = { appearance: 'light' }

// Empty states rise in (26 §10); wait for the entrance rather than sampling mid-way.
const settled = (element: HTMLElement) => waitFor(() => expect(element).toBeVisible())

// Progress (s39): "Chorus riff" (bars 17–20 of Riff in A minor) climbed from 60 to 85 % over nine
// sessions, the last yesterday; Bridge bends 6 days ago, an unnamed loop 9 days ago and two clips
// 12 and 20 days ago (only three are worth a revisit). Practised on 4 of the last 7 days.
const songId = (n: number) => LIBRARY[n - 1]?.id ?? ''
const loop = (n: number, song: number, name: string | null, from: number, to: number) => ({
  id: `00000000-0000-4000-c000-${String(n).padStart(12, '0')}`,
  song_id: songId(song),
  name,
  start_bar: from - 1,
  start_beat: 1,
  end_bar: to - 1,
  end_beat: 4,
  start_s: 2 * (from - 1),
  end_s: 2 * to,
  rest_between: 'none' as const,
  count_in_bars: 1,
  trainer: null,
  best_clean_tempo_pct: null,
  created_at: '2026-10-22T10:00:00Z',
})
const CHORUS = {
  ...loop(1, 1, 'Chorus riff', 17, 20),
  best_clean_tempo_pct: 85,
  trainer: {
    start_pct: 60,
    end_pct: 100,
    step_pct: 5,
    plays_per_step: 3,
    count_in_each_pass: false,
    drop_after_misses: 2,
    on_goal: 'keep' as const,
    current_pct: 75,
  },
}
const BRIDGE = { ...loop(2, 4, 'Bridge bends', 3, 4), best_clean_tempo_pct: 65 }
const LOOSE = { ...loop(3, 5, null, 9, 12), best_clean_tempo_pct: 90 }
const SOLO = { ...loop(4, 6, 'Solo run', 25, 28), best_clean_tempo_pct: 55 }
const INTRO = { ...loop(5, 6, 'Intro', 1, 4), best_clean_tempo_pct: 50 }
const LOOPS = [CHORUS, BRIDGE, LOOSE, SOLO, INTRO]
const on = (clip: (typeof LOOPS)[number]) => ({
  id: clip.id,
  song_id: clip.song_id,
  name: clip.name,
})
const SESSIONS: StorySession[] = [
  { daysAgo: 27, minutes: 18, passes: climb(55, 60), clip: on(CHORUS) },
  { daysAgo: 24, minutes: 20, passes: climb(60, 65), clip: on(CHORUS) },
  { daysAgo: 20, minutes: 15, passes: climb(45, 50, 1), clip: on(INTRO) },
  { daysAgo: 20, minutes: 22, passes: climb(60, 70), clip: on(CHORUS) },
  { daysAgo: 16, minutes: 12, passes: climb(65, 70), clip: on(CHORUS) },
  { daysAgo: 13, minutes: 25, passes: climb(65, 75), clip: on(CHORUS) },
  { daysAgo: 12, minutes: 14, passes: climb(50, 55), clip: on(SOLO) },
  { daysAgo: 9, minutes: 16, passes: climb(70, 75), clip: on(CHORUS) },
  { daysAgo: 9, minutes: 10, passes: climb(85, 90), clip: on(LOOSE) },
  { daysAgo: 6, minutes: 7, passes: climb(60, 65), clip: on(BRIDGE) },
  { daysAgo: 5, minutes: 12, passes: climb(70, 80), clip: on(CHORUS) },
  { daysAgo: 3, minutes: 31, passes: climb(70, 80), clip: on(CHORUS) },
  { daysAgo: 1, minutes: 24, passes: climb(70, 85), clip: on(CHORUS) },
]
const LIBRARY_PROGRESS = storyProgress(SESSIONS)

function seed(songs = LIBRARY, worker = WORKER_ONLINE, filters: LibrarySearch = {}) {
  return (client: QueryClient) => {
    client.setQueryData(
      progressQuery.queryKey,
      songs.length > 0 ? LIBRARY_PROGRESS : { clips: [], sessions: [] },
    )
    client.setQueryData(['practice-outbox'], { sessions: [], attempts: [] })
    for (const n of [1, 4, 5, 6]) {
      client.setQueryData(orpc.loops.list.queryKey({ input: { id: songId(n) } }), {
        items: LOOPS.filter((l) => l.song_id === songId(n)),
      })
      client.setQueryData(orpc.songs.get.queryKey({ input: { id: songId(n) } }), detail(n, null))
    }
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

const main = (canvasElement: HTMLElement) =>
  within(canvasElement.querySelector('main') as HTMLElement)

/** The titles of the rows in one group, by its name. */
const groupTitles = (canvasElement: HTMLElement, name: string) =>
  [
    ...within(canvasElement)
      .getByRole('region', { name })
      .querySelectorAll('[data-slot=list-row-title]'),
  ].map((title) => title.textContent)

const playPopulated: Story['play'] = async ({ canvasElement }) => {
  const canvas = main(canvasElement)
  await expect(await canvas.findByRole('heading', { level: 1, name: 'Library' })).toBeVisible()
  // Every status is a glyph and words (26 §12.2), never a tinted pill.
  for (const label of [
    'Ready',
    'Analysing 3/8',
    'Queued',
    'Chords only',
    'Partial',
    'Stems expired',
    'Failed',
    'Upload not finished',
  ]) {
    const words = await canvas.findByText(label)
    await expect(words.closest('[data-slot=status]')?.querySelector('svg')).not.toBeNull()
  }
  await expect(canvasElement.querySelector('[data-slot=badge]')).toBeNull()
  // Rows are grouped by what each song needs (s47 direction §6), each group in the list's order.
  await expect(groupTitles(canvasElement, 'Getting ready')).toEqual([
    'Walking bass in F',
    'Campfire strumming',
  ])
  await expect(groupTitles(canvasElement, 'Needs you')).toEqual([
    'Old practice take',
    'Corrupted voice memo',
    'Song from the bus',
  ])
  await expect(groupTitles(canvasElement, 'Ready to practise')).toEqual([
    'Riff in A minor',
    'Ballad with a capo',
    expect.stringMatching(/^Indie Rock/),
  ])
  // Continue: the most recently opened song, its clip and bars, what it works towards and the
  // 30-day sparkline (27 §3.5), with no box around it.
  const lead = within(canvas.getByRole('region', { name: 'Pick up where you left off' }))
  await expect(lead.getByRole('heading', { level: 2, name: 'Riff in A minor' })).toBeVisible()
  await expect(lead.getByText('Chorus riff', { selector: 'strong' })).toBeVisible()
  await expect(lead.getByText(/bars 17–20 · yesterday, 24\smin$/)).toBeVisible()
  await expect(lead.getByText(/^Ladder at 75\s% → 100\s%$/)).toBeVisible()
  await expect(lead.getByText('Best clean 85 %')).toBeVisible()
  await expect(lead.getByText("Yesterday's first clean pass: 70 %")).toBeVisible()
  await expect(
    lead.getByRole('img', { name: 'Best clean speed rose from 60 to 85 percent over 9 sessions' }),
  ).toBeVisible()
  // This week: figures and seven day bars, never a streak or a missed day.
  const week = within(canvas.getByRole('region', { name: 'This week' }))
  await expect(week.getByRole('img', { name: 'Practised on 4 of the last 7 days' })).toBeVisible()
  await expect(week.getByText('+10 %')).toBeVisible()
  await expect(week.getByText('on Chorus riff')).toBeVisible()
  await expect(week.getByText('1 h 14')).toBeVisible()
  await expect(canvasElement.textContent).not.toMatch(/streak|missed|in a row/i)
  // Worth a revisit: three clips, the newest first, each opening Practice on its bars.
  const revisit = within(canvas.getByRole('region', { name: 'Worth a revisit' }))
  const links = revisit.getAllByRole('link')
  await expect(links.map((link) => link.textContent)).toEqual([
    expect.stringMatching(/^Bridge bendsBallad with a capo · 6 days ago · best 65\s%$/),
    expect.stringMatching(/^Bars 9–12Indie Rock .* · best 90\s%$/),
    expect.stringMatching(/^Solo runOld practice take · .* · best 55\s%$/),
  ])
  await expect(links[0]).toHaveAttribute(
    'href',
    `/songs/${songId(4)}/practice?loop=3-4&tab=progress`,
  )
  // What each state means and what to do, beside it.
  await expect(canvas.getAllByText('You can loop it already').length).toBeGreaterThan(0)
  await expect(canvas.getByText('Add stems + tab with a Full analysis')).toBeVisible()
  await settled(await canvas.findByText(/Isolating your part · about \d+ min left/))
  await settled(await canvas.findByText(/This didn't use an analysis\./))
  await expect(
    canvas.getByRole('button', { name: 'Try again: Corrupted voice memo' }),
  ).toBeVisible()
  await expect(
    canvas.getByRole('button', { name: 'Re-create stems: Old practice take' }),
  ).toBeVisible()
  // The whole row opens Practice; its own controls are 44 px targets above it.
  const riff = canvas.getByRole('link', { name: /^Riff in A minor/ })
  await expect(riff).toHaveAttribute('href', `/songs/${songId(1)}/practice`)
  await expectTargets(canvas.getAllByRole('button', { name: /^More for / }))
  // Resume practice is the page's one filled control.
  const resume = canvas.getByRole('link', { name: 'Resume practice' })
  await expect(resume).toHaveAttribute('href', `/songs/${songId(1)}/practice`)
  const ink = document.createElement('span')
  ink.className = 'bg-primary'
  canvasElement.append(ink)
  const fill = getComputedStyle(ink).backgroundColor
  ink.remove()
  const filled = [...canvasElement.querySelectorAll('main a, main button')].filter(
    (control) => getComputedStyle(control).backgroundColor === fill,
  )
  await expect(filled).toEqual([resume])
}

export const Populated: Story = { render: populated, play: playPopulated }
export const PopulatedDaylight: Story = {
  render: populated,
  play: playPopulated,
  globals: DAYLIGHT,
}
export const PopulatedIncreasedContrast: Story = {
  render: populated,
  play: playPopulated,
  globals: { contrast: 'more' },
}
export const PopulatedDaylightIncreasedContrast: Story = {
  render: populated,
  play: playPopulated,
  globals: { ...DAYLIGHT, contrast: 'more' },
}

// Phones (27 §3.5 Phone): the status sits under the title, so titles keep the row's width and
// never share it with the status; the instrument filter is a menu; no revisit rows.
const playPhone: Story['play'] = async ({ canvasElement }) => {
  const canvas = main(canvasElement)
  const walking = await canvas.findByRole('link', { name: /^Walking bass in F/ })
  const row = walking.closest('[data-slot=list-row]') as HTMLElement
  const title = row.querySelector('[data-slot=list-row-title]') as HTMLElement
  const status = within(row).getByText('Analysing 3/8')
  await expect(status.getBoundingClientRect().top).toBeGreaterThan(
    title.getBoundingClientRect().bottom - 1,
  )
  await expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
  await expect(canvas.getByRole('region', { name: 'Pick up where you left off' })).toBeVisible()
  // Resume practice takes the row's width on a phone.
  const resume = canvas.getByRole('link', { name: 'Resume practice' })
  await expect(resume.getBoundingClientRect().width).toBeGreaterThan(window.innerWidth - 40)
  await expect(canvas.getByRole('img', { name: 'Practised on 4 of the last 7 days' })).toBeVisible()
  await expect(canvas.queryByRole('region', { name: 'Worth a revisit' })).toBeNull()
  await expect(canvas.getByRole('combobox', { name: 'Instrument' })).toBeVisible()
  await expect(canvas.getByRole('searchbox', { name: 'Filter by title' })).toBeVisible()
  // Nothing is wider than the screen.
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
}
export const PopulatedPhone: Story = { render: populated, play: playPhone, globals: PHONE }
export const PopulatedPhoneDaylight: Story = {
  render: populated,
  play: playPhone,
  globals: { ...PHONE, ...DAYLIGHT },
}

// Tablet: no rail, the status column beside the title, no music strip yet.
export const PopulatedTablet: Story = {
  render: populated,
  globals: TABLET,
  play: async ({ canvasElement }) => {
    const canvas = main(canvasElement)
    const row = (await canvas.findByRole('link', { name: /^Walking bass in F/ })).closest(
      '[data-slot=list-row]',
    ) as HTMLElement
    await expect(row.querySelector('[data-slot=music-strip]')).toBeNull()
    await expect(within(row).getByText('Analysing 3/8')).toBeVisible()
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}
export const PopulatedTabletDaylight: Story = {
  ...PopulatedTablet,
  globals: { ...TABLET, ...DAYLIGHT },
}

// The filters come from the router here, so the instrument pills and the Show and sort menus
// navigate like the app; each control names its current value.
function RoutedScreen() {
  const search = useRouterState({ select: (state) => state.location.search as LibrarySearch })
  return <Screen search={search} />
}

function SearchProbe() {
  const search = useRouterState({ select: (state) => state.location.search })
  return (
    <output data-testid="search" hidden>
      {JSON.stringify(search)}
    </output>
  )
}

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
    const all = within(chips).getByRole('button', { name: 'All' })
    await expect(all).toHaveAttribute('aria-pressed', 'true')
    // The chosen pill is the ink edge, not a fill (26 §4.5).
    await expect(getComputedStyle(all).boxShadow).toContain('1.5px')
    await userEvent.click(within(chips).getByRole('button', { name: 'Bass' }))
    await waitFor(() => expect(canvas.getByTestId('search').textContent).toContain('"bass"'))
    // What is shown is its own control, and its trigger names the filter that is on.
    await userEvent.click(canvas.getByRole('button', { name: 'Show: All' }))
    const show = within(await within(document.body).findByRole('menu'))
    await userEvent.click(await show.findByRole('menuitemradio', { name: 'Failed' }))
    await waitFor(() => expect(canvas.getByTestId('search').textContent).toContain('"failed"'))
    await expect(await canvas.findByRole('button', { name: 'Show: Failed' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /^Sort by: / }))
    const sort = within(await within(document.body).findByRole('menu'))
    await userEvent.click(await sort.findByRole('menuitemradio', { name: 'Title' }))
    await waitFor(() => expect(canvas.getByTestId('search').textContent).toContain('"title"'))
  },
}

export const WorkerOffline: Story = {
  render: () => (
    <AppStory path="/library" seed={seed(LIBRARY, WORKER_OFFLINE)}>
      <Screen />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = main(canvasElement)
    await expect(
      await canvas.findByText(
        'Processing machine offline. Your song is queued and starts automatically.',
      ),
    ).toBeVisible()
    await expect(
      canvas.getByText('Processing machine offline. Starts automatically.'),
    ).toBeVisible()
  },
}

const empty = () => (
  <AppStory path="/library" seed={seed([])}>
    <Screen />
  </AppStory>
)
const playEmpty: Story['play'] = async ({ canvasElement }) => {
  const canvas = main(canvasElement)
  await settled(
    await canvas.findByRole('heading', { name: 'Bring the first song you want to learn' }),
  )
  await expect(
    canvas.getByText('Drop a file anywhere on this page, paste a link, or record it.'),
  ).toBeVisible()
  // One filled control: Add song, with its key printed on it.
  const add = canvas.getByRole('button', { name: 'Add song' })
  await expect(add).toHaveAttribute('aria-keyshortcuts', 'A')
  await expect(add).toHaveAttribute('data-variant', 'primary')
  await expect(canvas.getByRole('link', { name: 'Try an example' })).toHaveAttribute(
    'href',
    '/start',
  )
  await expect(canvasElement.querySelectorAll('[data-variant=primary]')).toHaveLength(1)
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
    const canvas = main(canvasElement)
    await settled(await canvas.findByRole('heading', { name: 'No matching songs' }))
    await expect(canvas.getByText('No songs match. Try another search or filter.')).toBeVisible()
    // One way out, and it isn't a filled control competing with the page's.
    const clear = canvas.getAllByRole('button', { name: 'Clear filters' })
    await expect(clear).toHaveLength(1)
    await expect(clear[0]).not.toHaveAttribute('data-variant', 'primary')
  },
}

// The skeleton is the final layout: the title, the Continue block, the toolbar and hairline rows.
const loading = () => (
  <AppStory path="/library">
    <AppShell me={ME}>
      <LibrarySkeleton />
    </AppShell>
  </AppStory>
)
const playLoading: Story['play'] = async ({ canvasElement }) => {
  const canvas = main(canvasElement)
  await expect(canvas.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible()
  await expect(canvas.getByRole('list', { name: 'Loading your library' })).toHaveAttribute(
    'aria-busy',
    'true',
  )
}
export const Loading: Story = { render: loading, play: playLoading }
export const LoadingDaylight: Story = { render: loading, play: playLoading, globals: DAYLIGHT }

// Nothing seeded: the list request fails against Storybook's server.
export const LoadError: Story = {
  render: () => (
    <AppStory path="/library" seed={(client) => client.setQueryData(meQuery.queryKey, ME)}>
      <Screen />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = main(canvasElement)
    // The failing request goes to Storybook's server; give it time under a busy test run.
    await expect(
      await canvas.findByText("We couldn't load your library.", undefined, { timeout: 5_000 }),
    ).toBeVisible()
    await expect(canvas.getByText(/Songs you've opened on this device still play/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible()
  },
}

// Offline (27 §4): cached rows stay; the ones that need the server say so.
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
    const canvas = main(canvasElement)
    const needs = await canvas.findAllByText('Needs connection')
    await expect(needs[0]?.closest('[data-slot=status]')?.getAttribute('data-kind')).toBe('offline')
    await expect(canvasElement.querySelectorAll('[data-unavailable]').length).toBe(needs.length)
  },
}

// This week and Worth a revisit on their own, with fixture data: a day's bar grows with its
// minutes (height, not lightness), and a day without practice is a dash.
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
    <div className="flex max-w-library flex-col gap-10 p-6">
      <WeekStrip
        days={WEEK}
        stats={[
          { value: '1 h 20', label: 'practised' },
          { value: '23', label: 'clean passes' },
          { value: '+10 %', label: 'on Chorus riff' },
        ]}
      />
      <RevisitList
        clips={CLIPS}
        // biome-ignore lint/a11y/useAnchorContent: the row fills the link with its title and meta
        renderLink={(clip) => <a href={`#${clip.id}`} />}
      />
    </div>
  </AppStory>
)
const playProgress: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByRole('img', { name: 'Practised on 4 of the last 7 days' })).toBeVisible()
  const bars = [...canvasElement.querySelectorAll<HTMLElement>('[data-minutes]')]
  const height = (minutes: number) =>
    bars.find((bar) => bar.dataset['minutes'] === String(minutes))?.getBoundingClientRect()
      .height ?? 0
  await expect(bars).toHaveLength(4)
  await expect(height(31)).toBeGreaterThan(height(24))
  await expect(height(24)).toBeGreaterThan(height(18))
  await expect(height(18)).toBeGreaterThan(height(7))
  await expect(canvas.getByRole('heading', { name: 'Worth a revisit' })).toBeVisible()
  await expect(canvas.getAllByRole('link')).toHaveLength(3)
}
export const ProgressSections: Story = { render: progressSections, play: playProgress }
export const ProgressSectionsDaylight: Story = {
  render: progressSections,
  play: playProgress,
  globals: DAYLIGHT,
}
