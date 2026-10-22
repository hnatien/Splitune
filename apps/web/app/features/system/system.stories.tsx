import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { usePlaybackActive, usePwa } from '@/lib/app-state'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { AppShell } from '../shell/app-shell'
import { BareShell } from '../shell/bare-shell'
import { ME } from '../story-fixtures'
import { ErrorPage, NotFoundPage } from './error-page'
import { UnsupportedBrowser } from './unsupported'

// System pages and banners (27 §3.11): 404, the error boundary with a copyable error id,
// unsupported browser, "A new version is ready" and the iOS install hint.
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

const BarePage = () => (
  <AppStory path="/auth/sign-in">
    <BareShell>
      <p>Page</p>
    </BareShell>
  </AppStory>
)

// A new version waiting (27 §3.11): the banner offers the reload, but never while audio plays.
export const UpdateReady: Story = {
  beforeEach: () => {
    usePwa.setState({ updateReady: true })
    return () => usePwa.setState({ updateReady: false })
  },
  render: () => <BarePage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('A new version is ready.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Reload' })).toBeVisible()
  },
}
export const UpdateHeldWhilePlaying: Story = {
  beforeEach: () => {
    usePwa.setState({ updateReady: true })
    usePlaybackActive.setState({ active: true })
    return () => {
      usePwa.setState({ updateReady: false })
      usePlaybackActive.setState({ active: false })
    }
  },
  render: () => <BarePage />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('A new version is ready.')).toBeNull()
  },
}

// Safari on iOS/iPadOS, not installed (navigator.standalone === false): the app shell's hint.
export const InstallHintIos: Story = {
  beforeEach: () => {
    Object.defineProperty(navigator, 'standalone', { value: false, configurable: true })
    localStorage.removeItem('splitune.install-hint')
    return () => {
      Reflect.deleteProperty(navigator, 'standalone')
    }
  },
  render: () => (
    <AppStory path="/library" seed={(client) => client.setQueryData(meQuery.queryKey, ME)}>
      <AppShell me={ME}>
        <p>Library</p>
      </AppShell>
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText('Install Splitune: tap Share, then Add to Home Screen.'),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }))
    await expect(canvas.queryByText(/Add to Home Screen/)).toBeNull()
  },
}
