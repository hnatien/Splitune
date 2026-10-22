import summary from '@splitune/contracts/fixtures/summary.json'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { GlanceView } from './glance-view'
import { PracticeProvider } from './practice-context'
import { PracticePage } from './practice-page'
import { ALL, type Kind, SONG_ID, seed, tone } from './practice-story-data'

// The practice screen (27 §3.7) on the contracts' 8-bar Am–F–C–G fixture: the progressive states
// as artefacts land (§3.7.3), the chords-only fallback, the editor and mixer overlays, Dark and
// Stage, and the phone glance view. Audio is a generated tone; nothing reaches the network.
const meta = { title: 'Screens/Practice', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const screen =
  (kinds: Kind[], patch: { summary?: unknown; running?: boolean } = {}) =>
  () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(kinds, patch)}>
      <PracticePage songId={SONG_ID} search={{}} fetchAudio={tone} />
    </AppStory>
  )

const playable = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.getByRole('button', { name: 'Play' })).toBeEnabled(), {
    timeout: 20_000,
  })
  return canvas
}

/** Local audio only (27 §3.7.3): the paper placeholder with the analysis stages. */
export const Analysing: Story = {
  render: screen([], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(canvas.getByText("Tab will appear here as soon as it's ready")).toBeVisible()
    await expect(canvas.getByRole('progressbar')).toBeVisible()
  },
}

/** + beats: bar numbers, bar-snapped loops, count-in available. */
export const BeatsFound: Story = {
  render: screen(['beats'], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await expect(await canvas.findByRole('list', { name: 'Bars' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Count-in' })).toBeEnabled()
  },
}

/** + stems + chords: the chord strip and the chord sheet, the mixer, the audition banner. */
export const Chords: Story = {
  render: screen(['beats', 'stems', 'chords'], { running: true }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    // The chord sheet's code loads on demand.
    const sheet = await canvas.findByRole('region', { name: 'Chord sheet' }, { timeout: 10_000 })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(sheet).toBeVisible())
    await expect(await canvas.findByRole('button', { name: 'Mix' })).toBeVisible()
  },
}

/** + tab: everything (the primary state). */
export const Ready: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(tab).toBeVisible())
  },
}

export const ReadyDark: Story = { render: screen(ALL), globals: { appearance: 'dark' } }

/** Stage: chrome reduced to the transport and the loop badge; reading sizes +1 step. */
export const ReadyStage: Story = { render: screen(ALL), globals: { appearance: 'stage' } }

export const ReadyAtTheStand: Story = {
  render: screen(ALL),
  globals: { distance: 'stand' },
}

const CHORDS_ONLY = {
  ...summary,
  per_instrument: [
    {
      instrument: 'guitar',
      note_confidence_mean: 0.4,
      fraction_low_conf: 0.6,
      recommended_view: 'chords_only',
      reasons: ['low_confidence'],
    },
  ],
}

/** summary.recommended_view = chords_only: the banner with "Show tab anyway" (12 §4). */
export const ChordsOnlyFallback: Story = {
  render: screen(ALL, { summary: CHORDS_ONLY }),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const show = await canvas.findByRole('button', { name: 'Show tab anyway' })
    await userEvent.click(show)
    const tab = await canvas.findByRole('region', { name: 'Tab' }, { timeout: 20_000 })
    // Layers fade in (200 ms, 27 §3.7.3).
    await waitFor(() => expect(tab).toBeVisible())
  },
}

/** Tap a chord chip: the editor with the top-k alternatives as frequencies (27 §3.7.4). */
export const Editor: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    const strip = await canvas.findByRole('list', { name: 'Chords' })
    await userEvent.click(await within(strip).findByRole('button', { name: /^G/ }))
    const body = within(canvasElement.ownerDocument.body)
    // The sheet's code loads on first open.
    const editor = await body.findByRole('dialog', { name: 'Edit this bar' }, { timeout: 10_000 })
    await expect(within(editor).getAllByText(/about 1 in \d+/i)[0]).toBeVisible()
  },
}

export const Mixer: Story = {
  render: screen(ALL),
  play: async ({ canvasElement }) => {
    const canvas = await playable(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Mix' }))
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByRole('dialog', { name: 'Mix' }, { timeout: 10_000 }),
    ).toBeVisible()
    await expect(body.getByText('Your part', { selector: '[data-slot=badge]' })).toBeVisible()
  },
}

/** Phone portrait default (26 §6.3): current and next chord, bar.beat, speed. */
export const Glance: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(ALL)}>
      <PracticeProvider songId={SONG_ID} search={{}} fetchAudio={tone}>
        <div data-density="practice" className="flex h-[40rem] flex-col">
          <GlanceView />
        </div>
      </PracticeProvider>
    </AppStory>
  ),
  globals: { distance: 'floor' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('region', { name: 'Current chord' })).toBeVisible()
  },
}
