import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { BareShell } from '../shell/bare-shell'
import { ErrorPage, NotFoundPage } from './error-page'
import { UnsupportedBrowser } from './unsupported'

// System pages (27 §3.11): 404, the error boundary with a copyable error id, unsupported browser.
const meta = { title: 'Screens/System', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const NotFound: Story = {
  render: () => (
    <AppStory path="/nope">
      <NotFoundPage />
    </AppStory>
  ),
}
export const ScreenError: Story = {
  render: () => (
    <AppStory path="/library">
      <ErrorPage error={new Error('story')} />
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Error id: [0-9a-f]{8}/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Copy error id' })).toBeVisible()
  },
}
export const ScreenErrorDark: Story = {
  render: () => (
    <AppStory path="/library">
      <ErrorPage error={new Error('story')} />
    </AppStory>
  ),
  globals: { appearance: 'dark' },
}
export const Unsupported: Story = {
  render: () => (
    <AppStory path="/unsupported">
      <BareShell>
        <UnsupportedBrowser />
      </BareShell>
    </AppStory>
  ),
}
