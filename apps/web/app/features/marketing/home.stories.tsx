import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { MarketingShell } from '../shell/marketing-shell'
import { Home } from './home'

// Home (27 §3.1, `Home.dc.html`) in the marketing shell, signed out and signed in, in Night
// Rehearsal and Daylight, and on a phone, where the hero still and the sections stack.
const meta = { title: 'Screens/Home', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }

const home = (signedIn: boolean) => () => (
  <AppStory>
    <MarketingShell signedIn={signedIn}>
      <Home />
    </MarketingShell>
  </AppStory>
)

async function noSidewaysScroll(canvasElement: HTMLElement) {
  const root = canvasElement.ownerDocument.documentElement
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
}

export const SignedOut: Story = {
  render: home(false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('heading', {
        level: 1,
        name: 'Bring any song. Practise just your part.',
      }),
    ).toBeVisible()
    await expect(
      within(canvas.getByRole('banner')).getByRole('link', { name: 'Try an example song' }),
    ).toBeVisible()
    // The hero still is one picture with a text alternative, never a set of controls.
    const still = canvas.getByRole('img', {
      name: 'The practice screen, looping bars 25 to 28 at 75 percent',
    })
    await expect(within(still).queryAllByRole('button')).toHaveLength(0)
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Made for the music stand' }),
    ).toBeVisible()
    // Honesty gates (27 §3.1): no claim of a step that hasn't shipped.
    await expect(canvas.queryByText(/Every stem has its own fader/)).toBeNull()
    await expect(canvas.queryByText(/speed ladder|beat lights|Stand view/)).toBeNull()
  },
}
export const SignedIn: Story = { render: home(true) }
export const Daylight: Story = { render: home(false), globals: { appearance: 'light' } }
export const Phone: Story = {
  render: home(false),
  globals: PHONE,
  play: async ({ canvasElement }) => noSidewaysScroll(canvasElement),
}
export const PhoneDaylight: Story = {
  render: home(false),
  globals: { appearance: 'light', ...PHONE },
  play: async ({ canvasElement }) => noSidewaysScroll(canvasElement),
}
