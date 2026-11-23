import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { MarketingShell } from '../shell/marketing-shell'
import { Home } from './home'
import {
  DAYLIGHT,
  DESKTOP,
  expectReadablePictures,
  filledControls,
  noSidewaysScroll,
  PHONE,
  TABLET,
  VIEWPORTS,
} from './story-checks'

// Home (27 §3.1, s47 direction §1) in the marketing shell: the practice screen drawn from the kit
// is the hero, under the promise and its one primary action. Signed out and signed in, in Dark and
// Light, at 1440, 768 and 375.
const meta = {
  title: 'Screens/Home',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
type Play = NonNullable<Story['play']>

const home = (signedIn: boolean) => () => (
  <AppStory>
    <MarketingShell signedIn={signedIn}>
      <Home signedIn={signedIn} />
    </MarketingShell>
  </AppStory>
)

const playSignedOut: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(
    await canvas.findByRole('heading', {
      level: 1,
      name: 'Bring any song. Practise just your part.',
    }),
  ).toBeVisible()
  // One filled control on the page: the hero's way in to the example song.
  const main = canvas.getByRole('main')
  const [primary, ...others] = filledControls(canvasElement)
  await expect(others).toHaveLength(0)
  await expect(primary).toHaveAccessibleName('Try an example song')
  await expect(primary).toHaveAttribute('href', '/start')
  await expect(main).toContainElement(primary as HTMLElement)
  // The product is the picture: the practice screen, one image with a text alternative, and no
  // decorative photography.
  const still = within(main).getByRole('img', { name: /^Splitune's practice screen/ })
  await expect(still).toBeVisible()
  await expect(
    still.querySelector('[data-slot=transport-button][data-tone=primary]'),
  ).not.toBeNull()
  await expect(canvasElement.querySelectorAll('img')).toHaveLength(0)
  for (const name of [
    'Hear your part on its own',
    'Loop it slow, then climb',
    "Tab that admits when it's unsure",
  ]) {
    await expect(canvas.getByRole('heading', { level: 2, name })).toBeVisible()
  }
  await expect(
    canvas.getByRole('heading', { level: 2, name: 'Made for the music stand' }),
  ).toBeVisible()
  // Honesty gates (27 §3.1): no claim of a step that hasn't shipped.
  await expect(canvas.queryByText(/Every stem has its own fader/)).toBeNull()
  await expect(canvas.queryByText(/speed ladder|beat lights|Stand view/)).toBeNull()
  await expectReadablePictures(canvasElement)
  await noSidewaysScroll(canvasElement)
}

export const SignedOut: Story = { render: home(false), globals: DESKTOP, play: playSignedOut }
export const SignedOutDaylight: Story = {
  render: home(false),
  globals: { ...DESKTOP, ...DAYLIGHT },
  play: playSignedOut,
}
export const Tablet: Story = { render: home(false), globals: TABLET, play: playSignedOut }
export const Phone: Story = { render: home(false), globals: PHONE, play: playSignedOut }
export const PhoneDaylight: Story = {
  render: home(false),
  globals: { ...PHONE, ...DAYLIGHT },
  play: playSignedOut,
}

/** A member gets the way back to their library, not the guest pitch. */
const playSignedIn: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const main = within(await canvas.findByRole('main'))
  const [primary, ...others] = filledControls(canvasElement)
  await expect(others).toHaveLength(0)
  await expect(primary).toHaveAccessibleName('Open your library')
  await expect(primary).toHaveAttribute('href', '/library')
  await expect(main.queryByText(/no account needed/)).toBeNull()
  await expect(main.queryByRole('link', { name: 'Try an example song' })).toBeNull()
  await expect(canvas.queryByRole('link', { name: 'Sign in' })).toBeNull()
  await noSidewaysScroll(canvasElement)
}

export const SignedIn: Story = { render: home(true), globals: DESKTOP, play: playSignedIn }
export const SignedInDaylight: Story = {
  render: home(true),
  globals: { ...TABLET, ...DAYLIGHT },
  play: playSignedIn,
}
export const SignedInPhone: Story = { render: home(true), globals: PHONE, play: playSignedIn }
