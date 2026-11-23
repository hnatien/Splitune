import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { usePlaybackActive, usePwa } from '@/lib/app-state'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import {
  DAYLIGHT,
  DESKTOP,
  filledControls,
  noSidewaysScroll,
  PHONE,
  TABLET,
  VIEWPORTS,
} from '../marketing/story-checks'
import { AppShell } from '../shell/app-shell'
import { BareShell } from '../shell/bare-shell'
import { ME } from '../story-fixtures'
import { AccountDeleted } from './account-deleted'
import { ErrorPage, NotFoundPage } from './error-page'
import { UnsupportedBrowser } from './unsupported'

// System pages and banners (27 §3.11, s47 direction §1): 404, the error boundary with a copyable
// error id, unsupported browser and the page after an account was deleted (15 §4), each a plain
// message with one primary action and a way out that fits who is reading; and the banners every
// shell shows (offline, the in-app-browser hint, "A new version is ready", the iOS install hint),
// each one quiet line with a glyph, never a tinted bar. Dark and Light at 1440, 768 and 375.
const meta = {
  title: 'Screens/System',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
type Play = NonNullable<Story['play']>

const signedIn = (client: QueryClient) => client.setQueryData(meQuery.queryKey, ME)
const signedOut = (client: QueryClient) => client.setQueryData(meQuery.queryKey, null)

/** A system page is a message, not a card: nothing around it is boxed or filled. */
async function expectPlainMessage(canvasElement: HTMLElement) {
  const main = canvasElement.querySelector('main') as HTMLElement
  for (const element of main.querySelectorAll('*')) {
    const style = getComputedStyle(element)
    if (element.closest('a, button')) continue
    await expect(style.borderTopStyle === 'none' || style.borderTopWidth === '0px').toBe(true)
  }
  // It reads from the top of the page, not the middle of an empty viewport.
  const heading = main.querySelector('h1') as HTMLElement
  await expect(heading.getBoundingClientRect().top).toBeLessThan(260)
  await expect(filledControls(canvasElement)).toHaveLength(1)
  await noSidewaysScroll(canvasElement)
}

const accountDeleted = () => (
  <AppStory path="/account-deleted" seed={signedOut}>
    <BareShell>
      <AccountDeleted />
    </BareShell>
  </AppStory>
)

const playAccountDeleted: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(
    await canvas.findByRole('heading', { level: 1, name: 'Your account was deleted' }),
  ).toBeVisible()
  await expect(canvas.getByText(/signed out on every device/)).toBeVisible()
  await expect(canvas.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
    'href',
    '/',
  )
  await expectPlainMessage(canvasElement)
}
export const AccountWasDeleted: Story = {
  render: accountDeleted,
  globals: DESKTOP,
  play: playAccountDeleted,
}
export const AccountWasDeletedDaylight: Story = {
  render: accountDeleted,
  globals: { ...DESKTOP, ...DAYLIGHT },
  play: playAccountDeleted,
}
export const AccountWasDeletedPhone: Story = {
  render: accountDeleted,
  globals: PHONE,
  play: playAccountDeleted,
}

const notFound = (seed: (client: QueryClient) => void) => () => (
  <AppStory path="/nope" seed={seed}>
    <NotFoundPage />
  </AppStory>
)

// 404 (27 §3.11): the quiet number, what happened, why, and the way out for who is reading.
const playNotFound =
  (member: boolean): Play =>
  async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('heading', { level: 1, name: "We couldn't find that page." }),
    ).toBeVisible()
    await expect(canvas.getByText('404')).toBeVisible()
    const [primary] = filledControls(canvasElement)
    if (member) {
      await expect(primary).toHaveAccessibleName('Go to library')
      await expect(primary).toHaveAttribute('href', '/library')
    } else {
      // Signed out: home and the example song, never the library (which would bounce to sign in).
      await expect(primary).toHaveAccessibleName('Go to the home page')
      await expect(canvas.getByRole('link', { name: 'Try an example song' })).toBeVisible()
      await expect(canvas.queryByRole('link', { name: 'Go to library' })).toBeNull()
    }
    await expectPlainMessage(canvasElement)
  }
export const NotFound: Story = {
  render: notFound(signedOut),
  globals: DESKTOP,
  play: playNotFound(false),
}
export const NotFoundDaylight: Story = {
  render: notFound(signedOut),
  globals: { ...TABLET, ...DAYLIGHT },
  play: playNotFound(false),
}
export const NotFoundPhone: Story = {
  render: notFound(signedOut),
  globals: PHONE,
  play: playNotFound(false),
}
export const NotFoundSignedIn: Story = {
  render: notFound(signedIn),
  globals: DESKTOP,
  play: playNotFound(true),
}

const screenError = (seed: (client: QueryClient) => void) => () => (
  <AppStory path="/library" seed={seed}>
    <ErrorPage error={new Error('story')} />
  </AppStory>
)

// The error boundary: what happened, what it means, what Reload does, and the error id in the
// page's own type to copy into a report.
const playScreenError: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(
    await canvas.findByRole('heading', { level: 1, name: 'Something went wrong on this screen.' }),
  ).toBeVisible()
  await expect(canvas.getByText(/^Your songs and progress are safe\./)).toBeVisible()
  const id = canvas.getByText(/Error id: [0-9a-f]{8}/)
  await expect(getComputedStyle(id).fontFamily).not.toMatch(/mono/i)
  await expect(canvas.getByRole('button', { name: 'Copy error id' })).toBeVisible()
  const [primary] = filledControls(canvasElement)
  await expect(primary).toHaveAccessibleName('Reload')
  await expect(canvas.getByRole('link', { name: 'Go to library' })).toHaveAttribute(
    'href',
    '/library',
  )
  await expectPlainMessage(canvasElement)
}
export const ScreenError: Story = {
  render: screenError(signedIn),
  globals: DESKTOP,
  play: playScreenError,
}
export const ScreenErrorDaylight: Story = {
  render: screenError(signedIn),
  globals: { ...PHONE, ...DAYLIGHT },
  play: playScreenError,
}
export const ScreenErrorSignedOut: Story = {
  render: screenError(signedOut),
  globals: TABLET,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
      'href',
      '/',
    )
    await expect(canvas.queryByRole('link', { name: 'Go to library' })).toBeNull()
  },
}

const unsupported = (seed: (client: QueryClient) => void) => () => (
  <AppStory path="/unsupported" seed={seed}>
    <BareShell>
      <UnsupportedBrowser />
    </BareShell>
  </AppStory>
)

// Unsupported browser (27 §3.11): the missing feature in plain words, versions under a Details
// disclosure that reads as one, Copy link as the one primary.
const playUnsupported =
  (member: boolean): Play =>
  async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole('heading', { name: "Splitune can't run in this browser" }),
    ).toBeVisible()
    await expect(
      canvas.getByText(/^It's missing .+. Try a recent Chrome, Edge, Firefox or Safari.$/),
    ).toBeVisible()
    const details = canvas.getByText('Details').closest('details') as HTMLDetailsElement
    await expect(canvas.getByText(/^It works in Chrome/)).not.toBeVisible()
    const chevron = details.querySelector('summary svg') as SVGElement
    await expect(getComputedStyle(chevron).rotate).toBe('none')
    await userEvent.click(canvas.getByText('Details'))
    await expect(details.open).toBe(true)
    await expect(canvas.getByText(/^It works in Chrome/)).toBeVisible()
    await waitFor(() => expect(getComputedStyle(chevron).rotate).toBe('180deg'))
    const [primary] = filledControls(canvasElement)
    await expect(primary).toHaveAccessibleName('Copy link')
    if (member) {
      await expect(
        canvas.getByRole('link', { name: 'Your library is still available' }),
      ).toHaveAttribute('href', '/library')
    } else {
      await expect(canvas.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
        'href',
        '/',
      )
    }
    await noSidewaysScroll(canvasElement)
  }
export const Unsupported: Story = {
  render: unsupported(signedIn),
  globals: DESKTOP,
  play: playUnsupported(true),
}
export const UnsupportedDaylight: Story = {
  render: unsupported(signedIn),
  globals: { ...TABLET, ...DAYLIGHT },
  play: playUnsupported(true),
}
export const UnsupportedPhone: Story = {
  render: unsupported(signedOut),
  globals: PHONE,
  play: playUnsupported(false),
}

const BarePage = () => (
  <AppStory path="/auth/sign-in">
    <BareShell>
      <p>Page</p>
    </BareShell>
  </AppStory>
)

/** One quiet line: a hairline under it, no tinted fill, a glyph beside the words. */
async function expectQuietLine(banner: HTMLElement) {
  await expect(getComputedStyle(banner).backgroundColor).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  await expect(banner.querySelector('svg')).not.toBeNull()
}

// A new version waiting (27 §3.11): the banner offers the reload, but never while audio plays.
export const UpdateReady: Story = {
  beforeEach: () => {
    usePwa.setState({ updateReady: true })
    return () => usePwa.setState({ updateReady: false })
  },
  globals: DESKTOP,
  render: () => <BarePage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('A new version is ready.')).toBeVisible())
    const banner = canvas.getByText('A new version is ready.').closest('[data-slot=banner]')
    await expectQuietLine(banner as HTMLElement)
    await expect(canvas.getByRole('button', { name: 'Reload' })).toHaveAttribute(
      'data-variant',
      'outline',
    )
  },
}
export const UpdateReadyPhone: Story = { ...UpdateReady, globals: { ...PHONE, appearance: 'dark' } }
export const UpdateReadyPhoneDaylight: Story = {
  ...UpdateReady,
  globals: { ...PHONE, ...DAYLIGHT },
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
  globals: PHONE,
  render: () => (
    <AppStory path="/library" seed={signedIn}>
      <AppShell me={ME}>
        <p>Library</p>
      </AppShell>
    </AppStory>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const hint = await canvas.findByText('Install Splitune: tap Share, then Add to Home Screen.')
    await waitFor(() => expect(hint).toBeVisible())
    await expectQuietLine(hint.closest('[data-slot=banner]') as HTMLElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }))
    await expect(canvas.queryByText(/Add to Home Screen/)).toBeNull()
  },
}

const libraryPage = () => (
  <AppStory path="/library" seed={signedIn}>
    <AppShell me={ME}>
      <p>Library</p>
    </AppShell>
  </AppStory>
)

// No connection (27 §3.11): the offline line under the bar, with the struck cloud.
export const Offline: Story = {
  beforeEach: () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    return () => {
      Reflect.deleteProperty(navigator, 'onLine')
    }
  },
  globals: DESKTOP,
  render: libraryPage,
  play: async ({ canvasElement }) => {
    const notice = await within(canvasElement).findByText(
      "You're offline. Songs you've opened keep working.",
    )
    await waitFor(() => expect(notice).toBeVisible())
    await expectQuietLine(notice.closest('[data-slot=banner]') as HTMLElement)
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
  globals: DESKTOP,
  render: libraryPage,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const notice = await canvas.findByText('Open in your browser for audio and uploads.')
    await waitFor(() => expect(notice).toBeVisible())
    await expectQuietLine(notice.closest('[data-slot=banner]') as HTMLElement)
    await expect(canvas.getByRole('button', { name: 'Copy link' })).toBeVisible()
  },
}
export const OfflineDaylight: Story = { ...Offline, globals: { ...TABLET, ...DAYLIGHT } }
export const InAppBrowserPhone: Story = { ...InAppBrowser, globals: PHONE }
