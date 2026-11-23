import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { contrastRatio, sameColour, tokenColour } from '@/ui/fixtures'
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
import { BareShell } from './bare-shell'
import { MarketingShell } from './marketing-shell'

// The public shells (27 §1, s47 direction §1): the marketing shell (the bar with the page you are
// on marked by an ink line, no filled control of its own, the phone menu, the footer, signed in
// and out) and the bare shell of checkout and the system pages. Dark and Light at 1440, 768, 375.
const meta = {
  title: 'Shell/Public',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
type Play = NonNullable<Story['play']>

const marketing =
  (signedIn: boolean, path = '/pricing') =>
  () => (
    <AppStory path={path}>
      <MarketingShell signedIn={signedIn}>
        <p className="mx-auto max-w-page px-4 py-8">Page content</p>
      </MarketingShell>
    </AppStory>
  )

/** The current page's 2 px ink line, at 3:1 or more against the bar. */
async function expectCurrent(link: HTMLElement) {
  await expect(link).toHaveAttribute('aria-current', 'page')
  const line = getComputedStyle(link, '::after')
  await expect(line.height).toBe('2px')
  const ink = tokenColour('--selected', link)
  await expect(sameColour(line.backgroundColor, ink)).toBe(true)
  await expect(contrastRatio(ink, tokenColour('--background', link))).toBeGreaterThanOrEqual(3)
}

const playDesktop: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const bar = within(await canvas.findByRole('banner'))
  const nav = within(bar.getByRole('navigation', { name: 'Main' }))
  await expectCurrent(nav.getByRole('link', { name: 'Pricing' }))
  await expect(nav.getByRole('link', { name: 'How it works' })).not.toHaveAttribute('aria-current')
  await expect(nav.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/sign-in')
  await expect(bar.getByRole('link', { name: 'Try an example song' })).toHaveAttribute(
    'href',
    '/start',
  )
  // The bar leaves the page its one filled control.
  await expect(filledControls(canvasElement)).toHaveLength(0)
  await expect(canvas.queryByRole('button', { name: 'Menu' })).toBeNull()
  await expectCurrent(
    within(canvas.getByRole('navigation', { name: 'Footer' })).getByRole('link', {
      name: 'Pricing',
    }),
  )
  await noSidewaysScroll(canvasElement)
}

export const MarketingDesktop: Story = {
  render: marketing(false),
  globals: DESKTOP,
  play: playDesktop,
}
export const MarketingDesktopDaylight: Story = {
  render: marketing(false),
  globals: { ...DESKTOP, ...DAYLIGHT },
  play: playDesktop,
}
export const MarketingTablet: Story = {
  render: marketing(false),
  globals: TABLET,
  play: playDesktop,
}
export const MarketingSignedIn: Story = {
  render: marketing(true, '/how-it-works'),
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const bar = within(await within(canvasElement).findByRole('banner'))
    await expect(bar.getByRole('link', { name: 'Library' })).toHaveAttribute('href', '/library')
    await expect(bar.queryByRole('link', { name: 'Sign in' })).toBeNull()
    await expectCurrent(bar.getByRole('link', { name: 'How it works' }))
  },
}

// On phones the way in stays in the bar beside the wordmark; the rest is behind Menu, with the
// current page checked. The pinned bar stays one row.
const playPhoneMenu: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const banner = await canvas.findByRole('banner')
  await expect(banner.getBoundingClientRect().height).toBeLessThan(80)
  await expect(getComputedStyle(banner).position).toBe('sticky')
  await expect(within(banner).getByRole('link', { name: 'Try an example song' })).toBeVisible()
  await userEvent.click(within(banner).getByRole('button', { name: 'Menu' }))
  const menu = within(await within(document.body).findByRole('menu'))
  await expect(menu.getByRole('menuitem', { name: 'How it works' })).toHaveAttribute(
    'href',
    '/how-it-works',
  )
  const pricing = menu.getByRole('menuitem', { name: 'Pricing' })
  await expect(pricing).toHaveAttribute('href', '/pricing')
  await expect(pricing).toHaveAttribute('aria-current', 'page')
  await expect(pricing.querySelector('svg')).not.toBeNull()
  await expect(menu.getByRole('menuitem', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/auth/sign-in',
  )
  await expect(menu.queryByRole('menuitem', { name: 'Try an example song' })).toBeNull()
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull())
  await noSidewaysScroll(canvasElement)
}
export const MarketingPhoneMenuOpen: Story = {
  render: marketing(false),
  play: playPhoneMenu,
  globals: PHONE,
}
export const MarketingPhoneMenuOpenDaylight: Story = {
  render: marketing(false),
  play: playPhoneMenu,
  globals: { ...PHONE, ...DAYLIGHT },
}
export const MarketingPhoneSignedIn: Story = {
  render: marketing(true),
  globals: PHONE,
  play: async ({ canvasElement }) => {
    const banner = await within(canvasElement).findByRole('banner')
    await expect(within(banner).getByRole('link', { name: 'Library' })).toBeVisible()
    await noSidewaysScroll(canvasElement)
  },
}

const bare = () => (
  <AppStory path="/account-deleted">
    <BareShell>
      <h1 className="pt-16 text-display">Page</h1>
    </BareShell>
  </AppStory>
)

const playBare: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByRole('link', { name: 'Splitune home' })).toHaveAttribute(
    'href',
    '/',
  )
  // One column of at most 480 px.
  const main = canvas.getByRole('main')
  await expect(main.getBoundingClientRect().width).toBeLessThanOrEqual(480)
  await expect(canvas.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument()
  await noSidewaysScroll(canvasElement)
}
export const Bare: Story = { render: bare, globals: DESKTOP, play: playBare }
export const BareDaylight: Story = {
  render: bare,
  globals: { ...DESKTOP, ...DAYLIGHT },
  play: playBare,
}
export const BarePhone: Story = { render: bare, globals: PHONE, play: playBare }
