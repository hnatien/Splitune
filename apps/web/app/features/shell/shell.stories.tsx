import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { ME } from '../story-fixtures'
import { AppShell } from './app-shell'
import { FocusShell } from './focus-shell'
import { MarketingShell } from './marketing-shell'

// The shells (27 §1): the app shell with its top links from sm up and the bottom tab bar on
// phones, the account menu with its Help group, the marketing shell's phone Menu and the focus
// shell. Phone stories set the viewport global, so the same breakpoints apply as in the app.
const meta = { title: 'Screens/Shell', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }

const appShell = (path: string) => () => (
  <AppStory path={path} seed={(client) => client.setQueryData(meQuery.queryKey, ME)}>
    <AppShell me={ME}>
      <h1 className="text-3xl">Library</h1>
      <p className="mt-2 text-muted-foreground">Page content</p>
    </AppShell>
  </AppStory>
)

const playDesktop: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const nav = await canvas.findByRole('navigation', { name: 'Main' })
  const links = within(nav).getAllByRole('link')
  await expect(links.map((link) => link.textContent)).toEqual(['Library', 'Import', 'Settings'])
  await expect(within(nav).getByRole('link', { name: 'Library' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(within(nav).getByRole('link', { name: 'Import' })).not.toHaveAttribute(
    'aria-current',
  )
  await expect(canvasElement.querySelector('[data-slot="bottom-tabs"]')).not.toBeVisible()
}

export const AppDesktop: Story = { render: appShell('/library'), play: playDesktop }
export const AppDesktopDark: Story = {
  render: appShell('/library'),
  play: playDesktop,
  globals: { appearance: 'dark' },
}
export const AppDesktopStage: Story = {
  render: appShell('/library'),
  play: playDesktop,
  globals: { appearance: 'stage' },
}

// Any settings section keeps Settings current, though the link leads to Profile.
export const AppDesktopSettingsCurrent: Story = {
  render: appShell('/settings/billing'),
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole('navigation', { name: 'Main' })
    await expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(within(nav).getByRole('link', { name: 'Library' })).not.toHaveAttribute(
      'aria-current',
    )
  },
}

const playPhone: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const nav = await canvas.findByRole('navigation', { name: 'Main' })
  await expect(nav).toHaveAttribute('data-slot', 'bottom-tabs')
  await expect(nav).toBeVisible()
  await expect(
    within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Library', 'Import', 'Settings'])
  await expect(within(nav).getByRole('link', { name: 'Library' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  // The top bar keeps the brand and the account menu only.
  await expect(canvas.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1)
  await expect(canvas.getByRole('button', { name: 'Account' })).toBeVisible()
}

export const AppPhone: Story = {
  render: appShell('/library'),
  play: playPhone,
  globals: PHONE,
}
export const AppPhoneDark: Story = {
  render: appShell('/library'),
  play: playPhone,
  globals: { ...PHONE, appearance: 'dark' },
}
export const AppPhoneStage: Story = {
  render: appShell('/library'),
  play: playPhone,
  globals: { ...PHONE, appearance: 'stage' },
}
export const AppPhoneImportCurrent: Story = {
  render: appShell('/import'),
  globals: PHONE,
  play: async ({ canvasElement }) => {
    const nav = await within(canvasElement).findByRole('navigation', { name: 'Main' })
    await expect(within(nav).getByRole('link', { name: 'Import' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}

// The account menu: the account links, Appearance, the Help group and Sign out.
const playAccountMenu: Story['play'] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Account' }))
  const menu = within(await within(document.body).findByRole('menu'))
  await waitFor(() => expect(menu.getByText('Help')).toBeVisible())
  await expect(menu.getByRole('menuitem', { name: 'How it works' })).toHaveAttribute(
    'href',
    '/how-it-works',
  )
  await expect(menu.getByRole('menuitem', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  await expect(menu.getByRole('menuitem', { name: 'Terms' })).toHaveAttribute(
    'href',
    '/legal/terms',
  )
  await expect(menu.getByRole('menuitem', { name: 'Privacy' })).toHaveAttribute(
    'href',
    '/legal/privacy',
  )
  await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
}
export const AccountMenuOpen: Story = { render: appShell('/library'), play: playAccountMenu }
export const AccountMenuOpenDark: Story = {
  render: appShell('/library'),
  play: playAccountMenu,
  globals: { appearance: 'dark' },
}
export const AccountMenuOpenStage: Story = {
  render: appShell('/library'),
  play: playAccountMenu,
  globals: { appearance: 'stage' },
}

const marketing = (signedIn: boolean) => () => (
  <AppStory path="/">
    <MarketingShell signedIn={signedIn}>
      <p className="mx-auto max-w-page px-4 py-8">Page content</p>
    </MarketingShell>
  </AppStory>
)

export const MarketingDesktop: Story = {
  render: marketing(false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: 'Try an example song' })).toHaveAttribute(
      'href',
      '/start',
    )
    const header = within(canvas.getByRole('banner'))
    await expect(header.getByRole('link', { name: 'How it works' })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Pricing' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Menu' })).toBeNull()
  },
}
export const MarketingDesktopSignedIn: Story = { render: marketing(true) }

// Below sm everything but the wordmark collapses into the Menu button, so the pinned bar is one row.
const playMarketingMenu: Story['play'] = async ({ canvasElement }) => {
  const banner = await within(canvasElement).findByRole('banner')
  await expect(banner.getBoundingClientRect().height).toBeLessThan(80)
  await expect(getComputedStyle(banner).position).toBe('sticky')
  await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Menu' }))
  const menu = within(await within(document.body).findByRole('menu'))
  await expect(menu.getByRole('menuitem', { name: 'How it works' })).toHaveAttribute(
    'href',
    '/how-it-works',
  )
  await expect(menu.getByRole('menuitem', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
  await expect(menu.getByRole('menuitem', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/auth/sign-in',
  )
  await expect(menu.getByRole('menuitem', { name: 'Try an example song' })).toHaveAttribute(
    'href',
    '/start',
  )
}
export const MarketingPhoneMenuOpen: Story = {
  render: marketing(false),
  play: playMarketingMenu,
  globals: PHONE,
}
export const MarketingPhoneMenuOpenDark: Story = {
  render: marketing(false),
  play: playMarketingMenu,
  globals: { ...PHONE, appearance: 'dark' },
}
export const MarketingPhoneMenuOpenStage: Story = {
  render: marketing(false),
  play: playMarketingMenu,
  globals: { ...PHONE, appearance: 'stage' },
}

const focus = (exit: boolean) => () => (
  <AppStory path="/songs/s1/practice">
    <FocusShell exit={exit} status={<span className="truncate">Wonderwall</span>}>
      <p className="px-4 py-6">Page content</p>
    </FocusShell>
  </AppStory>
)

const playFocus: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByRole('link', { name: 'Back to library' })).toHaveAttribute(
    'href',
    '/library',
  )
  await expect(canvas.queryByRole('navigation', { name: 'Main' })).toBeNull()
}
export const FocusDesktop: Story = { render: focus(false), play: playFocus }
export const FocusDesktopDark: Story = {
  render: focus(false),
  play: playFocus,
  globals: { appearance: 'dark' },
}
export const FocusDesktopStage: Story = {
  render: focus(false),
  play: playFocus,
  globals: { appearance: 'stage' },
}
export const FocusPhone: Story = { render: focus(false), play: playFocus, globals: PHONE }
export const FocusExit: Story = {
  render: focus(true),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('link', { name: 'Exit' })).toHaveAttribute(
      'href',
      '/',
    )
  },
}
