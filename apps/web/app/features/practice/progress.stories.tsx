import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { m } from '@/lib/i18n'
import { AppStory } from '../../../.storybook/app.tsx'
import { memoryOutbox } from './model/outbox-memory'
import { configurePracticeSync } from './model/practice-sync'
import type { Progress } from './model/progress-metrics'
import { PracticePage } from './practice-page'
import { ALL, type Patch, SONG_ID, seed, storyClip, tone } from './practice-story-data'
import { progressQuery } from './progress-data'
import { useWeeklyGoal } from './progress-goal'
import { climb, type StorySession, storyProgress } from './progress-story-data'

// The Progress tab (27 §3.7.4, Practice-Piano.dc.html; s39) on the practice screen with the song's
// clip "Chorus riff" (bars 5–6) selected: 1 session, 9 sessions, 30 days, no clean pass yet, no
// clip selected, the Warm up chip and the Weekly goal, at 1200 (the runner's default), 1440 and
// 1180, in Dark and Light and with increased contrast. Sessions are placed relative to the run's
// own clock, so "Today" is today.
const VIEWPORTS = {
  desktop1440: {
    name: 'Desktop 1440',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  desktop1180: {
    name: 'Desktop 1180',
    styles: { width: '1180px', height: '820px' },
    type: 'desktop',
  },
}
const meta = {
  title: 'Screens/Practice Progress',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
  beforeEach: () => {
    configurePracticeSync({ db: memoryOutbox() })
    useWeeklyGoal.setState({ on: false, days: 3 })
  },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const CHORUS = storyClip(1, 'Chorus riff', 5, 6, { best_clean_tempo_pct: 80 })
const BRIDGE = storyClip(2, 'Bridge bends', 3, 4, { best_clean_tempo_pct: 65 })
const LOOSE = storyClip(3, null, 7, 8)

const CHORUS_REF = { id: CHORUS.id, song_id: SONG_ID, name: CHORUS.name }
const BRIDGE_REF = { id: BRIDGE.id, song_id: SONG_ID, name: BRIDGE.name }

/** Sessions on Chorus riff unless they name another clip. */
const progress = (sessions: (Omit<StorySession, 'clip'> & { clip?: StorySession['clip'] })[]) =>
  storyProgress(sessions.map((s) => ({ ...s, clip: s.clip ?? CHORUS_REF })))

const NINE = [
  { daysAgo: 27, minutes: 20, passes: climb(50, 60) },
  { daysAgo: 24, minutes: 15, passes: climb(55, 60) },
  { daysAgo: 21, minutes: 12, passes: climb(55, 65) },
  { daysAgo: 17, minutes: 22, passes: climb(60, 70) },
  { daysAgo: 13, minutes: 18, passes: climb(60, 70) },
  { daysAgo: 10, minutes: 25, passes: climb(65, 70) },
  { daysAgo: 6, minutes: 12, passes: climb(65, 75) },
  { daysAgo: 1, minutes: 20, passes: climb(70, 75) },
  { daysAgo: 0, minutes: 18, passes: climb(70, 80, 4) },
]

const withProgress =
  (data: Progress, patch: Patch = { clips: [CHORUS, BRIDGE, LOOSE] }, select = true) =>
  (client: QueryClient) => {
    seed(ALL, patch)(client)
    client.setQueryData(progressQuery.queryKey, data)
    client.setQueryData(['practice-outbox'], { sessions: [], attempts: [] })
    if (!select) {
      client.setQueryData(
        orpc.songs.get.queryKey({ input: { id: SONG_ID } }),
        (song) => song && { ...song, player_state: {} },
      )
    }
  }

const screen = (seeder: (client: QueryClient) => void) => () => (
  <AppStory path={`/songs/${SONG_ID}/practice`} seed={seeder}>
    <PracticePage songId={SONG_ID} search={{ tab: 'progress' }} fetchAudio={tone} />
  </AppStory>
)

/** The Progress tab's body once the screen and its clip are ready. */
const tab = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.getByRole('button', { name: 'Play' })).toBeEnabled(), {
    timeout: 20_000,
  })
  return within(await canvas.findByRole('tabpanel'))
}

const nineLabel =
  'Best clean speed rose from 60 to 80 percent over 9 sessions. First clean pass rose from 50 to 70 percent.'

/** Nine sessions over 27 days (the mockup's case): chart, stats, sessions. */
export const NineSessions: Story = {
  render: screen(withProgress(progress(NINE))),
  play: async ({ canvasElement }) => {
    const panel = await tab(canvasElement)
    await expect(await panel.findByRole('heading', { name: 'Chorus riff' })).toBeVisible()
    await expect(panel.getByText(m['progress.clip']())).toBeVisible()
    await expect(panel.getByText('bars 5–6')).toBeVisible()
    const chart = panel.getByRole('img', { name: nineLabel })
    await expect(chart.querySelectorAll('[data-marker=best]')).toHaveLength(9)
    await expect(panel.getByText(m['progress.legend_cold']())).toBeVisible()
    // Stat cards: today's cold start, clean passes of passes, minutes.
    await expect(panel.getByText('70 %', { selector: 'dd' })).toBeVisible()
    await expect(panel.getByText('3 / 7', { selector: 'dd' })).toBeVisible()
    await expect(panel.getByText('18 min', { selector: 'dd' })).toBeVisible()
    const rows = within(panel.getByRole('region', { name: m['progress.sessions']() })).getAllByRole(
      'listitem',
    )
    await expect(rows).toHaveLength(9)
    await expect(rows[0]).toHaveTextContent(/^Today18\smin · 7 passesbest 80\s%$/)
    await expect(rows[1]).toHaveTextContent(/^Yesterday/)
    // No streak or missed-day words: the only "streak" is the goal's "No streaks" promise.
    await expect(panel.queryByText(/missed|in a row|haven't practised/i)).toBeNull()
    await expect(panel.getAllByText(/streak/i).map((node) => node.textContent)).toEqual([
      m['progress.weekly_goal_hint'](),
    ])
  },
}

/** One session today: a chart of one point, its text alternative in the singular. */
export const OneSession: Story = {
  render: screen(withProgress(progress([{ daysAgo: 0, minutes: 9, passes: climb(55, 60) }]))),
  play: async ({ canvasElement }) => {
    const panel = await tab(canvasElement)
    await expect(
      await panel.findByRole('img', {
        name: 'Best clean speed 60 percent in one session. First clean pass 55 percent.',
      }),
    ).toBeVisible()
    await expect(
      within(panel.getByRole('region', { name: m['progress.sessions']() })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1)
  },
}

/** A session every day for 30 days: the chart stays readable and the rows scroll. */
export const ThirtyDays: Story = {
  render: screen(
    withProgress(
      progress(
        Array.from({ length: 30 }, (_, i) => ({
          daysAgo: 29 - i,
          minutes: 10 + (i % 4) * 5,
          passes: climb(Math.min(90, 45 + i), Math.min(100, 50 + i * 2 - (i % 6 === 3 ? 5 : 0))),
        })),
      ),
    ),
  ),
  play: async ({ canvasElement }) => {
    const panel = await tab(canvasElement)
    const chart = await panel.findByRole('img', { name: /over 30 sessions/ })
    await expect(chart.querySelectorAll('[data-marker=cold]')).toHaveLength(30)
  },
}

/** Passes today but none clean yet: the empty line in the chart's card, the counts still shown. */
export const NoCleanPass: Story = {
  render: screen(
    withProgress(
      progress([
        {
          daysAgo: 0,
          minutes: 6,
          passes: [
            [60, false],
            [60, false],
          ],
        },
      ]),
    ),
  ),
  play: async ({ canvasElement }) => {
    const panel = await tab(canvasElement)
    await expect(await panel.findByText(m['practice.progress_empty']())).toBeVisible()
    await expect(panel.queryByRole('img')).toBeNull()
    await expect(panel.getByText('0 / 2', { selector: 'dd' })).toBeVisible()
    await expect(panel.getByText('–', { selector: 'dd' })).toBeVisible()
    await expect(panel.getByText(m['progress.no_clean']())).toBeVisible()
  },
}

/** No loop selected: the song's clips with their best clean tempo; a row loops it. */
export const NoClip: Story = {
  render: screen(withProgress(progress(NINE), undefined, false)),
  play: async ({ canvasElement }) => {
    const panel = await tab(canvasElement)
    await expect(await panel.findByRole('heading', { name: m['progress.clips']() })).toBeVisible()
    const row = panel.getByRole('button', { name: /Bridge bends/ })
    await expect(row).toHaveTextContent(/best 65\s%/)
    await expect(panel.getByRole('button', { name: /Bars 7–8/ })).toHaveTextContent(
      m['progress.no_clean'](),
    )
    await userEvent.click(row)
    await expect(await panel.findByRole('heading', { name: 'Bridge bends' })).toBeVisible()
  },
}

/** No passes at all on the clip: the empty state of 27 §4. */
export const Empty: Story = {
  render: screen(withProgress({ clips: [], sessions: [] })),
  play: async ({ canvasElement }) => {
    const panel = await tab(canvasElement)
    await expect(await panel.findByText(m['practice.progress_empty']())).toBeVisible()
  },
}

/** First session of the day after practising yesterday: "Warm up with yesterday's hard bars"
 * loops the clip with the most "Not yet" passes yesterday (Bridge bends). */
export const WarmUp: Story = {
  render: screen(
    withProgress(
      progress([
        { daysAgo: 1, minutes: 20, passes: climb(70, 75) },
        {
          daysAgo: 1,
          minutes: 10,
          clip: BRIDGE_REF,
          passes: [...climb(60, 60, 3), [65, false]],
        },
      ]),
    ),
  ),
  play: async ({ canvasElement }) => {
    const panel = await tab(canvasElement)
    const chip = await panel.findByRole('button', { name: m['progress.warm_up']() })
    await userEvent.click(chip)
    await expect(await panel.findByRole('heading', { name: 'Bridge bends' })).toBeVisible()
    await expect(panel.queryByRole('button', { name: m['progress.warm_up']() })).toBeNull()
  },
}

/** Weekly goal on: days a week (1–7) and how many days this week have practice, never missed. */
export const WeeklyGoalOn: Story = {
  render: screen(withProgress(progress(NINE))),
  play: async ({ canvasElement }) => {
    const panel = await tab(canvasElement)
    const goal = await panel.findByRole('switch', { name: m['progress.weekly_goal']() })
    await expect(goal).not.toBeChecked()
    await userEvent.click(goal)
    await expect(goal).toBeChecked()
    await userEvent.click(panel.getByRole('button', { name: m['progress.goal_more']() }))
    await expect(panel.getByRole('status')).toHaveTextContent(/^\d of 4 days this week$/)
    await expect(useWeeklyGoal.getState()).toMatchObject({ on: true, days: 4 })
  },
}

export const Wide: Story = { ...NineSessions, globals: { viewport: { value: 'desktop1440' } } }

export const At1180: Story = { ...NineSessions, globals: { viewport: { value: 'desktop1180' } } }

export const Daylight: Story = { ...NineSessions, globals: { appearance: 'light' } }

export const Daylight1440: Story = {
  ...NineSessions,
  globals: { appearance: 'light', viewport: { value: 'desktop1440' } },
}

export const IncreasedContrast: Story = { ...NineSessions, globals: { contrast: 'more' } }

export const DaylightIncreasedContrast: Story = {
  ...NineSessions,
  globals: { appearance: 'light', contrast: 'more' },
}

export const WarmUpDaylight: Story = { ...WarmUp, globals: { appearance: 'light' } }

export const WeeklyGoalDaylight: Story = { ...WeeklyGoalOn, globals: { appearance: 'light' } }
