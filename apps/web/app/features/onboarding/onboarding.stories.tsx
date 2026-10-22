import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { useDisplay } from '@/lib/display-store'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { PracticePage } from '../practice/practice-page'
import { ALL, SONG_ID, seed, tone } from '../practice/practice-story-data'
import { ME } from '../story-fixtures'
import { type ExampleSong, examplesQuery } from './examples'
import { FirstSong } from './first-song'
import { OnboardingGuide } from './guide'
import { OnboardingPage, type StartSearch } from './onboarding-page'
import { SaveSheet } from './save-sheet'
import { SavedPage } from './saved-page'

// Onboarding (27 §3.3): the three questions, the example song (signed in; failed to load), the
// guide over the example's practice screen (song card, then the loop with its coach mark), the
// "Save your progress?" sheet and the page the magic link lands on. Nothing reaches the network.
const meta = { title: 'Screens/Onboarding', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const noop = () => undefined

function Steps({ initial }: { initial: StartSearch }) {
  const [search, setSearch] = useState(initial)
  return <OnboardingPage search={search} signedIn={false} go={setSearch} />
}

const start = (initial: StartSearch) => () => (
  <AppStory path="/start">
    <Steps initial={initial} />
  </AppStory>
)

export const Instrument: Story = {
  render: start({}),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Step 1 of 5')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^Piano/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Bass' }))
    await expect(await canvas.findByText('Step 2 of 5')).toBeVisible()
  },
}
export const InstrumentDark: Story = { render: start({}), globals: { appearance: 'dark' } }

export const Level: Story = {
  render: start({ step: 'level', instrument: 'guitar' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }))
    await expect(await canvas.findByText('Step 1 of 5')).toBeVisible()
  },
}

export const Screen: Story = {
  render: start({ step: 'screen', instrument: 'guitar', level: 'just_started' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const before = useDisplay.getState().distance
    await userEvent.click(canvas.getByRole('radio', { name: /Music stand/ }))
    await expect(canvas.getByRole('radio', { name: /Music stand/ })).toBeChecked()
    await expect(useDisplay.getState().distance).toBe('stand')
    // Skip keeps what was there before.
    await userEvent.click(canvas.getByRole('button', { name: 'Skip' }))
    await expect(useDisplay.getState().distance).toBe(before)
  },
}
export const ScreenDark: Story = {
  render: start({ step: 'screen', instrument: 'guitar', level: 'just_started' }),
  globals: { appearance: 'dark' },
}

/** The example song as GET /v1/examples gives it: the practice fixture as a ready song. */
function withExample(client: QueryClient) {
  seed(ALL)(client)
  const song = client.getQueryData(orpc.songs.get.queryKey({ input: { id: SONG_ID } }))
  if (!song) throw new Error('seed has no song')
  const example: ExampleSong = {
    id: 'ill-fate',
    title: 'Ill Fate',
    artist: 'Hollow Ground',
    instrument: 'guitar',
    part: 'riff',
    duration_s: 20.5,
    loop: { start_bar: 2, end_bar: 5 },
    speed_pct: { just_started: 70, few_songs: 80, returning: 80 },
    song: { ...song, title: 'Ill Fate', artist: 'Hollow Ground', source_kind: 'example' },
  }
  client.setQueryData(examplesQuery.queryKey, { items: [example] })
}

export const FirstSongSignedIn: Story = {
  render: () => (
    <AppStory path="/start" seed={withExample}>
      <FirstSong instrument="guitar" level="few_songs" signedIn onBack={noop} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/^Hollow Ground · guitar riff · 0:2\d$/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Play your part' })).toBeEnabled()
  },
}

/** GET /v1/examples failed (offline, API away): say so, offer a retry. */
export const ExamplesFailed: Story = {
  render: () => (
    <AppStory path="/start">
      <FirstSong instrument="guitar" level="few_songs" signedIn onBack={noop} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("We couldn't load the example songs.")).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible()
  },
}

const guide = () => (
  <AppStory path={`/songs/${SONG_ID}/practice`} seed={withExample}>
    <PracticePage
      songId={SONG_ID}
      search={{ loop: '3-6', speed: 70, mix: 'your-part', level: 'simplified' }}
      guest
      fetchAudio={tone}
    >
      <OnboardingGuide />
    </PracticePage>
  </AppStory>
)

/** Step 4 over the example's practice screen; "Play your part" starts step 5's loop. */
export const Guide: Story = {
  render: guide,
  play: async () => {
    const body = within(document.body)
    const card = await body.findByRole('dialog', { name: 'Your first song' })
    // "Getting your part ready…" until the audio is decoded and the loop set.
    const play = await within(card).findByRole(
      'button',
      { name: 'Play your part' },
      { timeout: 20_000 },
    )
    await waitFor(() => expect(play).toBeEnabled())
    await userEvent.click(play)
    await expect(await body.findByText(/We've looped bars 3–6 at 70\s%/)).toBeVisible()
    await expect(body.getByRole('button', { name: 'Pause' })).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: 'Pause' }))
  },
}
// The same steps, so the checks run on the loop (not on the screen dimmed behind the card).
export const GuideDark: Story = { ...Guide, globals: { appearance: 'dark' } }

const saveSheet = () => (
  <AppStory path={`/songs/${SONG_ID}/practice`}>
    <SaveSheet open onClose={noop} />
  </AppStory>
)

export const SaveProgress: Story = {
  render: saveSheet,
  play: async () => {
    const sheet = await within(document.body).findByRole('dialog', { name: 'Save your progress?' })
    await userEvent.type(within(sheet).getByLabelText('Email'), 'ana@')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Continue' }))
    await expect(within(sheet).getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(within(sheet).getByRole('button', { name: 'Not now' })).toBeVisible()
  },
}
export const SaveProgressDark: Story = {
  render: saveSheet,
  globals: { appearance: 'dark' },
}

function claimed(client: QueryClient) {
  withExample(client)
  client.setQueryData(['guest-claim'], [SONG_ID])
  client.setQueryData(meQuery.queryKey, ME)
}

/** Where the magic link lands: the progress is in the library; next, a song of their own. */
export const Saved: Story = {
  render: () => (
    <AppStory path="/start/saved" seed={claimed}>
      <SavedPage />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Your progress is saved' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Import a song' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Keep practising' })).toBeVisible()
  },
}

/** The claim failed: the progress stays on the device, with a retry. */
export const SaveFailed: Story = {
  render: () => (
    <AppStory path="/start/saved">
      <SavedPage />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("We couldn't save your progress. It's still on this device."),
    ).toBeVisible()
  },
}
