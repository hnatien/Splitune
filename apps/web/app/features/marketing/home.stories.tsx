import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { MarketingShell } from '../shell/marketing-shell'
import { Home } from './home'

// Home (27 §3.1) in the marketing shell, signed out and signed in.
const meta = { title: 'Screens/Home', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const home = (signedIn: boolean) => () => (
  <AppStory>
    <MarketingShell signedIn={signedIn}>
      <Home />
    </MarketingShell>
  </AppStory>
)

export const SignedOut: Story = {
  render: home(false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('heading', {
        level: 1,
        name: 'Learn the songs you love, one loop at a time.',
      }),
    ).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Try it free' })).toBeVisible()
  },
}
export const SignedIn: Story = { render: home(true) }
export const Dark: Story = { render: home(false), globals: { appearance: 'dark' } }
export const Stage: Story = { render: home(false), globals: { appearance: 'stage' } }
