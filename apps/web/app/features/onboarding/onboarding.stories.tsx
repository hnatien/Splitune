import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { orpc } from '@/lib/api'
import { meQuery } from '@/lib/session'
import { expectInkEdge, expectTargets } from '@/ui/story-kit'
import { AppStory } from '../../../.storybook/app.tsx'
import { PracticePage } from '../practice/practice-page'
import { ALL, SONG_ID, seed, tone } from '../practice/practice-story-data'
import { ME } from '../story-fixtures'
import { type ExampleSong, examplesQuery } from './examples'
import { OnboardingGuide } from './guide'
import { OnboardingPage, type StartSearch } from './onboarding-page'
import { SaveSheet } from './save-sheet'
import { SavedPage } from './saved-page'

// Onboarding (27 §3.3, s47 direction): /start as one page (what you play and how long, with
// defaults; the example songs as rows; a song of one's own; the one primary action in the bar at
// the bottom), the guide's quiet line over the example's practice screen, the "Save your
// progress?" dialog (a sheet on phones) and the page it lands on once signed in. Each in Dark and
// Light, on a phone and a wide screen. Nothing reaches the network.
const meta = { title: 'Screens/Onboarding', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const noop = () => undefined
const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const TABLET = { viewport: { value: 'tablet', isRotated: false } }
const LIGHT = { appearance: 'light' } as const

/** The examples as GET /v1/examples gives them: the practice fixture as three ready songs. */
function withExamples(client: QueryClient) {
  seed(ALL)(client)
  const song = client.getQueryData(orpc.songs.get.queryKey({ input: { id: SONG_ID } }))
  if (!song) throw new Error('seed has no song')
  const example = (
    id: string,
    title: string,
    instrument: ExampleSong['instrument'],
    part: ExampleSong['part'],
    songId: string,
  ): ExampleSong => ({
    id,
    title,
    artist: 'Hollow Ground',
    instrument,
    part,
    duration_s: 20.5,
    loop: { start_bar: 2, end_bar: 5 },
    speed_pct: { just_started: 70, few_songs: 80, returning: 80 },
    song: { ...song, id: songId, title, artist: 'Hollow Ground', source_kind: 'example' },
  })
  client.setQueryData(examplesQuery.queryKey, {
    items: [
      example('ill-fate', 'Ill Fate', 'guitar', 'riff', SONG_ID),
      example('stitch-up', 'Stitch Up', 'guitar', 'rhythm', '00000000-0000-4000-8000-0000000000a2'),
      example(
        'stitch-up-bass',
        'Stitch Up',
        'bass',
        'bass_line',
        '00000000-0000-4000-8000-0000000000a3',
      ),
    ],
  })
}

function Start({ initial, signedIn }: { initial: StartSearch; signedIn: boolean }) {
  const [search, setSearch] = useState(initial)
  return <OnboardingPage search={search} signedIn={signedIn} go={setSearch} />
}

const start =
  ({ initial = {}, signedIn = false, examples = true } = {}) =>
  () => (
    <AppStory path="/start" {...(examples ? { seed: withExamples } : {})}>
      <Start initial={initial} signedIn={signedIn} />
    </AppStory>
  )

/** The filled ink controls in a view: buttons say their variant, links carry its class. */
const filled = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>('a:not([href="#main"]), button')].filter(
    (el) =>
      el.getAttribute('data-variant') === 'primary' || /(^|\s)bg-primary(\s|$)/.test(el.className),
  )

const bar = (root: HTMLElement) =>
  within(root.querySelector<HTMLElement>('[data-slot=start-bar]') as HTMLElement)

/** A visitor's first view: the defaults chosen, the suggestion picked, one primary action. */
export const Setup: Story = {
  render: start(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Your first song' })).toBeVisible()
    // Defaults: guitar, just started, and the beginner's guitar rhythm part.
    const guitar = canvas.getByRole('radio', { name: /^Guitar/ })
    await expect(guitar).toBeChecked()
    await expectInkEdge(guitar)
    await expect(canvas.getByRole('radio', { name: /^Just started/ })).toBeChecked()
    const stitchUp = canvas.getByRole('radio', { name: /^Stitch Up.*Suggested.*guitar rhythm/ })
    await expect(stitchUp).toBeChecked()
    await expect(bar(canvasElement).getByText('guitar rhythm · bars 3–6 at 70 %')).toBeVisible()
    // Piano is listed, can't be chosen, and says so in its name.
    const piano = canvas.getByRole('radio', { name: /^Piano/ })
    await expect(piano).toHaveAttribute('aria-disabled', 'true')
    await expect(piano).toHaveAccessibleName(expect.stringContaining('Unavailable'))
    // One filled action on the page.
    const primaries = filled(canvasElement)
    await expect(primaries).toHaveLength(1)
    await expect(primaries[0]).toHaveTextContent('Start practising')
    await expectTargets(canvas.getAllByRole('radio'))
    // A visitor's own song goes through creating an account, then Add song on that tab.
    await expect(canvas.getByRole('link', { name: /^Upload a file/ })).toHaveAttribute(
      'href',
      '/auth/sign-up?next=%2Flibrary%3Fadd%3Dfile',
    )
    await expect(canvas.getByRole('link', { name: /^Paste a link/ })).toHaveAttribute(
      'href',
      '/auth/sign-up?next=%2Flibrary%3Fadd%3Dlink',
    )
    await expect(canvas.getByRole('link', { name: /^Record yourself/ })).toHaveAttribute(
      'href',
      '/auth/sign-up?next=%2Flibrary%3Fadd%3Drecord',
    )
    await expect(canvas.getByRole('link', { name: 'Exit' })).toHaveAttribute('href', '/')
  },
}
export const SetupDaylight: Story = { ...Setup, globals: LIGHT }

/** The songs offered are the chosen instrument's own: each listed once, none for another part. */
const songRows = (canvasElement: HTMLElement) =>
  within(within(canvasElement).getByRole('radiogroup', { name: 'Choose a song' })).getAllByRole(
    'radio',
  )

/** Changing an answer changes the suggestion, the songs offered and what the bar says. */
export const SetupAnswers: Story = {
  render: start(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(songRows(canvasElement).map((row) => row.textContent)).not.toContainEqual(
      expect.stringMatching(/bass line/),
    )
    await userEvent.click(canvas.getByRole('radio', { name: /^Bass/ }))
    await expect(
      await canvas.findByRole('radio', { name: /^Stitch Up.*Suggested.*bass line/ }),
    ).toBeChecked()
    await expect(songRows(canvasElement)).toHaveLength(1)
    await expect(canvas.getByRole('radio', { name: /^Guitar/ })).not.toBeChecked()
    await userEvent.click(canvas.getByRole('radio', { name: /^A few songs/ }))
    await expect(bar(canvasElement).getByText('bass line · bars 3–6 at 80 %')).toBeVisible()
    // Back on guitar, a song picked by hand stays picked, and the keyboard moves through the rows.
    await userEvent.click(canvas.getByRole('radio', { name: /^Guitar/ }))
    await expect(songRows(canvasElement)).toHaveLength(2)
    const stitchUp = canvas.getByRole('radio', { name: /^Stitch Up.*guitar rhythm/ })
    await userEvent.click(stitchUp)
    await expect(stitchUp).toBeChecked()
    await expect(bar(canvasElement).getByText('Stitch Up')).toBeVisible()
    await userEvent.keyboard('{ArrowUp}')
    await expect(canvas.getByRole('radio', { name: /^Ill Fate.*Suggested/ })).toBeChecked()
  },
}

/** At 375 px the primary action stays on screen above the fold, with no sideways scroll. */
export const SetupPhone: Story = {
  render: start(),
  globals: PHONE,
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument.documentElement
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    const action = bar(canvasElement).getByRole('button', { name: 'Start practising' })
    const box = action.getBoundingClientRect()
    await expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    await expect(box.top).toBeGreaterThanOrEqual(0)
    // What it will do wraps beside the action rather than being cut off.
    const plan = bar(canvasElement).getByText('guitar rhythm · bars 3–6 at 70 %')
    await expect(plan.scrollWidth).toBeLessThanOrEqual(plan.clientWidth)
    await expect(getComputedStyle(plan).textOverflow).not.toBe('ellipsis')
  },
}
export const SetupPhoneDaylight: Story = { ...SetupPhone, globals: { ...PHONE, ...LIGHT } }
export const SetupTablet: Story = { render: start(), globals: TABLET }

/** Signed in: Exit is the way back to the library, and a song of one's own opens Add song. */
export const SetupSignedIn: Story = {
  render: start({ signedIn: true, initial: { instrument: 'guitar', level: 'returning' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Back to library' })).toHaveAttribute(
      'href',
      '/library',
    )
    await expect(canvas.getByRole('link', { name: /^Paste a link/ })).toHaveAttribute(
      'href',
      '/library?add=link',
    )
    await expect(canvas.getByRole('radio', { name: /^Ill Fate.*Suggested/ })).toBeChecked()
    // Claiming the example fails here (no API): say so beside the songs, keep the choice.
    await userEvent.click(bar(canvasElement).getByRole('button', { name: 'Start practising' }))
    await expect(
      await canvas.findByText('Something went wrong on this screen.', undefined, {
        timeout: 10_000,
      }),
    ).toBeVisible()
  },
}

/** GET /v1/examples failed (offline, API away): say what it means, retry, or bring your own. */
export const ExamplesFailed: Story = {
  render: start({ examples: false }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The failed request settles after the query's retries; the 1 s default flakes in WebKit.
    await expect(
      await canvas.findByText("We couldn't load the example songs.", undefined, {
        timeout: 10_000,
      }),
    ).toBeVisible()
    await expect(canvas.getByText(/bring a song of your own/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: /^Upload a file/ })).toBeVisible()
    // No song, so no start bar to press.
    await expect(canvasElement.querySelector('[data-slot=start-bar]')).toBeNull()
  },
}
export const ExamplesFailedDaylight: Story = { ...ExamplesFailed, globals: LIGHT }

const guide = () => (
  <AppStory path={`/songs/${SONG_ID}/practice`} seed={withExamples}>
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

const guideLine = () =>
  document.querySelector<HTMLElement>('[data-slot=onboarding-guide]') as HTMLElement

/**
 * The guide over the example's practice screen: one line above the song map that says what will
 * play and that Play starts it; once playing, the loop it set. It covers nothing and Escape
 * dismisses it.
 */
export const Guide: Story = {
  render: guide,
  play: async () => {
    const body = within(document.body)
    const first = await body.findByText(
      /^Ill Fate: your guitar riff, bars 3–6 at 70\s%\. Press Play or Space to start\.$/,
      undefined,
      { timeout: 20_000 },
    )
    await expect(first).toBeVisible()
    await expect(body.getByRole('link', { name: 'Change song' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/start\?(.+&)?song=ill-fate$/),
    )
    // In the page's flow above the song map: nothing of the music or the transport is under it.
    const line = guideLine().getBoundingClientRect()
    for (const slot of ['notation', 'transport']) {
      const region = document.querySelector(`[data-slot=${slot}]`)?.getBoundingClientRect()
      if (region) await expect(line.bottom).toBeLessThanOrEqual(region.top)
    }
    // The tap on Play starts the audio (no autoplay); the line moves on to the loop.
    const play = body.getByRole('button', { name: 'Play' })
    await waitFor(() => expect(play).toBeEnabled(), { timeout: 20_000 })
    await userEvent.click(play)
    const tip = await body.findByText(/We've looped bars 3–6 at 70\s%/)
    await waitFor(() => expect(tip).toBeVisible())
    await expectTargets([body.getByRole('button', { name: /^Got it/ })])
    // Escape from the page dismisses it, and focus stays on the page for the practice keys.
    document.getElementById('main')?.focus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.querySelector('[data-slot=onboarding-guide]')).toBeNull())
    await expect(document.activeElement?.id).toBe('main')
    await userEvent.click(body.getByRole('button', { name: 'Pause' }))
  },
}
export const GuideDaylight: Story = { ...Guide, globals: LIGHT }
export const GuidePhone: Story = { render: guide, globals: PHONE }
export const GuidePhoneDaylight: Story = { render: guide, globals: { ...PHONE, ...LIGHT } }

/** "Got it" dismisses the line too, and the next one never comes back over the music. */
export const GuideGotIt: Story = {
  render: guide,
  play: async () => {
    const body = within(document.body)
    const gotIt = await body.findByRole('button', { name: /^Got it/ }, { timeout: 20_000 })
    await expect(gotIt).toHaveAttribute('aria-keyshortcuts', 'Esc')
    await userEvent.click(gotIt)
    await waitFor(() => expect(document.querySelector('[data-slot=onboarding-guide]')).toBeNull())
  },
}

const saveSheet = () => (
  <AppStory path={`/songs/${SONG_ID}/practice`}>
    <SaveSheet open onClose={noop} />
  </AppStory>
)

/** From 640 px a centred dialog: username, password, one filled button, and "Not now". */
export const SaveProgress: Story = {
  render: saveSheet,
  play: async () => {
    const sheet = await within(document.body).findByRole('dialog', { name: 'Save your progress?' })
    await expect(sheet).toHaveAttribute('data-slot', 'dialog-content')
    await userEvent.type(within(sheet).getByLabelText('Username'), 'ab')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Create account' }))
    await expect(within(sheet).getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true')
    await expect(within(sheet).getByRole('button', { name: 'Not now' })).toBeVisible()
    await expect(filled(sheet)).toHaveLength(1)
    // An existing account signs in instead.
    const switchMode = within(sheet).getByRole('button', { name: 'Sign in' })
    // Measured once the dialog has finished scaling in.
    await waitFor(() => expectTargets([switchMode]))
    await userEvent.click(switchMode)
    await expect(within(sheet).getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    await expect(within(sheet).getByRole('button', { name: 'Create an account' })).toBeVisible()
  },
}
export const SaveProgressDaylight: Story = { render: saveSheet, globals: LIGHT }

/** On a phone, a sheet from the bottom. */
export const SaveProgressPhone: Story = {
  render: saveSheet,
  globals: PHONE,
  play: async () => {
    const sheet = await within(document.body).findByRole('dialog', { name: 'Save your progress?' })
    await expect(sheet).toHaveAttribute('data-slot', 'drawer-popup')
    await expect(within(sheet).getByRole('button', { name: 'Not now' })).toBeVisible()
  },
}
export const SaveProgressPhoneDaylight: Story = {
  render: saveSheet,
  globals: { ...PHONE, ...LIGHT },
}

function claimed(client: QueryClient) {
  withExamples(client)
  client.setQueryData(['guest-claim'], [SONG_ID])
  client.setQueryData(meQuery.queryKey, ME)
}

function claimedNothing(client: QueryClient) {
  client.setQueryData(['guest-claim'], [])
  client.setQueryData(meQuery.queryKey, ME)
}

const saved = (seedWith?: (client: QueryClient) => void) => () => (
  <AppStory path="/start/saved" {...(seedWith ? { seed: seedWith } : {})}>
    <SavedPage />
  </AppStory>
)

/** After signing up from the sheet: the song is in the library; next, a song of their own. */
export const Saved: Story = {
  render: saved(claimed),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Your progress is saved' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Keep practising' })).toHaveAttribute(
      'href',
      `/songs/${SONG_ID}/practice`,
    )
    await expect(filled(canvasElement)).toEqual([canvas.getByRole('link', { name: 'Add song' })])
  },
}
export const SavedDaylight: Story = { ...Saved, globals: LIGHT }
export const SavedPhone: Story = { render: saved(claimed), globals: PHONE }

/** Signed in with nothing on the device: say that nothing was saved. */
export const SavedNothing: Story = {
  render: saved(claimedNothing),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: "You're signed in" })).toBeVisible()
    await expect(canvas.getByText('There was no practice on this device to save.')).toBeVisible()
    await expect(canvas.queryByRole('link', { name: 'Keep practising' })).toBeNull()
  },
}

/** The claim failed: the progress stays on the device, and "Try again" is the one filled action. */
export const SaveFailed: Story = {
  render: saved(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The failure is Storybook's server answering; under load that takes longer than the 1 s default.
    await expect(
      await canvas.findByText(
        "We couldn't save your progress. It's still on this device.",
        undefined,
        { timeout: 10_000 },
      ),
    ).toBeVisible()
    await expect(filled(canvasElement)).toEqual([canvas.getByRole('button', { name: 'Try again' })])
  },
}
export const SaveFailedPhoneDaylight: Story = { ...SaveFailed, globals: { ...PHONE, ...LIGHT } }
