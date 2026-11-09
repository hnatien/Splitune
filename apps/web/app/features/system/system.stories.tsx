import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { usePlaybackActive, usePwa } from '@/lib/app-state'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { AppShell } from '../shell/app-shell'
import { BareShell } from '../shell/bare-shell'
import { ME } from '../story-fixtures'
import { AccountDeleted } from './account-deleted'
import { ErrorPage, NotFoundPage } from './error-page'
import { UnsupportedBrowser } from './unsupported'

// System pages and banners (27 §3.11): 404, the error boundary with a copyable error id,
// unsupported browser, offline, the in-app-browser hint, "A new version is ready", the iOS install
// hint, and the page after an account was deleted (15 §4).
const meta = { title: 'Screens/System', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const DAYLIGHT = { appearance: 'light' }

const accountDeleted = () => (
  <AppStory path="/account-deleted">
    <BareShell>
      <AccountDeleted />
    </BareShell>
  </AppStory>
)
export const AccountWasDeleted: Story = {
  render: accountDeleted,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('heading', { name: 'Your account was deleted' }),
    ).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
      'href',
      '/',
    )
  },
}
export const AccountWasDeletedDaylight: Story = { render: accountDeleted, globals: DAYLIGHT }
export const AccountWasDeletedPhone: Story = { render: accountDeleted, globals: PHONE }

const notFound = () => (
  <AppStory path="/nope">
    <NotFoundPage />
  </AppStory>
)

// 404 (27 §3.11): the mono number, what happened, why, and the way to the library.
export const NotFound: Story = {
  render: notFound,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('heading', { level: 1, name: "We couldn't find that page." }),
    ).toBeVisible()
    await expect(canvas.getByText('404')).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Go to library' })).toHaveAttribute(
      'href',
      '/library',
    )
  },
}
export const NotFoundDaylight: Story = { render: notFound, globals: DAYLIGHT }
export const NotFoundPhone: Story = { render: notFound, globals: PHONE }
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
export const ScreenErrorDaylight: Story = {
  render: () => (
    <AppStory path="/library">
      <ErrorPage error={new Error('story')} />
    </AppStory>
  ),
  globals: DAYLIGHT,
}
const unsupported = () => (
  <AppStory path="/unsupported">
    <BareShell>
      <UnsupportedBrowser />
    </BareShell>
  </AppStory>
)

// Unsupported browser (27 §3.11): the missing feature in plain words, versions under Details.
export const Unsupported: Story = {
  render: unsupported,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('heading', { name: "Splitune can't run in this browser" }),
    ).toBeVisible()
    await expect(
      canvas.getByText(/^It's missing .+. Try a recent Chrome, Edge, Firefox or Safari.$/),
    ).toBeVisible()
    await expect(canvas.getByText(/^It works in Chrome/)).not.toBeVisible()
    await userEvent.click(canvas.getByText('Details'))
    await expect(canvas.getByText(/^It works in Chrome/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Copy link' })).toBeVisible()
    await expect(
      canvas.getByRole('link', { name: 'Your library is still available' }),
    ).toHaveAttribute('href', '/library')
  },
}
export const UnsupportedDaylight: Story = { render: unsupported, globals: DAYLIGHT }
export const UnsupportedPhone: Story = { render: unsupported, globals: PHONE }

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
    await waitFor(() =>
      expect(
        canvas.getByText('A new version is ready. It waits until you stop playing.'),
      ).toBeVisible(),
    )
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
    await expect(within(canvasElement).queryByText(/A new version is ready/)).toBeNull()
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
    const hint = await canvas.findByText('Install Splitune: tap Share, then Add to Home Screen.')
    await waitFor(() => expect(hint).toBeVisible())
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }))
    await expect(canvas.queryByText(/Add to Home Screen/)).toBeNull()
  },
}

const libraryPage = () => (
  <AppStory path="/library" seed={(client) => client.setQueryData(meQuery.queryKey, ME)}>
    <AppShell me={ME}>
      <p>Library</p>
    </AppShell>
  </AppStory>
)

// No connection (27 §3.11): the offline banner under the bar.
export const Offline: Story = {
  beforeEach: () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    return () => {
      Reflect.deleteProperty(navigator, 'onLine')
    }
  },
  render: libraryPage,
  play: async ({ canvasElement }) => {
    const notice = await within(canvasElement).findByText(
      "You're offline. Songs you've opened keep working.",
    )
    await waitFor(() => expect(notice).toBeVisible())
  },
}

// An in-app browser (Instagram's): "Open in your browser" with Copy link (24 §4).
export const InAppBrowser: Story = {
  beforeEach: () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: `${navigator.userAgent} Instagram 300.0`,
      configurable: true,
    })
    return () => {
      Reflect.deleteProperty(navigator, 'userAgent')
    }
  },
  render: libraryPage,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const notice = await canvas.findByText('Open in your browser for audio and uploads.')
    await waitFor(() => expect(notice).toBeVisible())
    await expect(canvas.getByRole('button', { name: 'Copy link' })).toBeVisible()
  },
}
export const OfflineDaylight: Story = { ...Offline, globals: DAYLIGHT }
export const InAppBrowserPhone: Story = { ...InAppBrowser, globals: PHONE }
