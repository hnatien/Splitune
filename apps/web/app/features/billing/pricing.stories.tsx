import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { meQuery } from '@/lib/session'
import { inkEdgeOf } from '@/ui/fixtures'
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
import { MarketingShell } from '../shell/marketing-shell'
import { ME, ME_PLUS, PLANS } from '../story-fixtures'
import { plansQuery } from './plans'
import { PricingPage, PricingUnavailable } from './pricing-page'

// Pricing (27 §3.2; 23 §5; s47 direction §1): Free and Plus compared as rows, the billing period
// as choice rows, signed out (Dark, Light, tablet, phone), on Free and on Plus, and prices that
// failed to load. No card fields anywhere (25 §2).
const meta = {
  title: 'Screens/Pricing',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
type Play = NonNullable<Story['play']>

const seed = (me: typeof ME | null) => (client: QueryClient) => {
  client.setQueryData(meQuery.queryKey, me)
  client.setQueryData(plansQuery.queryKey, PLANS)
}

async function noCardFields(canvasElement: HTMLElement) {
  const root = canvasElement.ownerDocument.body
  await expect(root.querySelectorAll('input:not([type=radio]):not([type=hidden])')).toHaveLength(0)
}

const pricing = (me: typeof ME | null) => () => (
  <AppStory path="/pricing" seed={seed(me)}>
    <MarketingShell signedIn={me !== null}>
      <PricingPage me={me} plans={PLANS} />
    </MarketingShell>
  </AppStory>
)

const playSignedOut: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const demo = await canvas.findByText(/^Demo mode — no real charges\./)
  await waitFor(() => expect(demo).toBeVisible())
  await expect(
    canvas.getByRole('heading', { level: 1, name: 'Every practice tool is free' }),
  ).toBeVisible()
  await expect(canvas.getByRole('region', { name: 'Free' })).toBeVisible()
  await expect(canvas.getByRole('region', { name: 'Plus' })).toBeVisible()
  // Monthly and yearly as equal rows with their prices, monthly chosen (23 §5), the chosen one
  // marked by the ink edge, not a grey fill.
  const period = canvas.getByRole('radiogroup', { name: 'Billing' })
  const monthly = within(period).getByRole('radio', { name: /Monthly/ })
  const yearly = within(period).getByRole('radio', { name: /Yearly/ })
  await expect(monthly).toBeChecked()
  await expect(within(period).getByText('$9.99 a month')).toBeVisible()
  await expect(within(period).getByText('$79.99 a year')).toBeVisible()
  await userEvent.click(yearly)
  await expect(yearly).toBeChecked()
  await waitFor(() => expect(inkEdgeOf(yearly).width).toBeGreaterThanOrEqual(1.5))
  await expect(inkEdgeOf(yearly).contrast).toBeGreaterThanOrEqual(3)
  await waitFor(() => expect(inkEdgeOf(monthly).width).toBe(0))
  await expect(canvas.getByRole('rowheader', { name: /Slow down to 25/ })).toBeVisible()
  // One filled control: Get Plus; the Free row's way in is an outline pill.
  const filled = filledControls(canvasElement)
  await expect(filled).toHaveLength(1)
  await expect(filled[0]).toHaveAccessibleName('Get Plus')
  const main = within(canvas.getByRole('main'))
  await expect(main.getByRole('link', { name: 'Try an example song' })).toBeVisible()
  await expect(canvas.queryByText(/most popular/i)).toBeNull()
  // Honesty gates (27 §3.2): nothing promised before its step ships.
  await expect(canvas.queryByText(/speed ladder|beat lights|Stand view|every stem/i)).toBeNull()
  await noCardFields(canvasElement)
  await noSidewaysScroll(canvasElement)
}

export const SignedOut: Story = { render: pricing(null), globals: DESKTOP, play: playSignedOut }
export const Daylight: Story = {
  render: pricing(null),
  globals: { ...DESKTOP, ...DAYLIGHT },
  play: playSignedOut,
}
export const Tablet: Story = { render: pricing(null), globals: TABLET, play: playSignedOut }
export const Phone: Story = { render: pricing(null), globals: PHONE, play: playSignedOut }
export const PhoneDaylight: Story = {
  render: pricing(null),
  globals: { ...PHONE, ...DAYLIGHT },
  play: playSignedOut,
}

/** On Free: Free is marked as your plan (a glyph and words) with the way to the library. */
const playOnFree: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByRole('button', { name: 'Get Plus' })).toBeVisible()
  const free = within(canvas.getByRole('region', { name: /^Free/ }))
  await expect(free.getByText('Your plan')).toBeVisible()
  await expect(free.getByRole('link', { name: 'Go to library' })).toHaveAttribute(
    'href',
    '/library',
  )
}
export const OnFree: Story = { render: pricing(ME), globals: DESKTOP, play: playOnFree }
export const OnFreeDaylight: Story = {
  render: pricing(ME),
  globals: { ...PHONE, ...DAYLIGHT },
  play: playOnFree,
}
export const OnPlus: Story = {
  render: pricing(ME_PLUS),
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: 'Manage your plan' })).toBeVisible()
    await expect(
      within(canvas.getByRole('region', { name: /^Plus/ })).getByText('Your plan'),
    ).toBeVisible()
  },
}

const retry = fn()
const unavailable = (signedIn: boolean) => () => (
  <AppStory path="/pricing">
    <MarketingShell signedIn={signedIn}>
      <PricingUnavailable signedIn={signedIn} failed onRetry={retry} />
    </MarketingShell>
  </AppStory>
)

/** Prices that failed stay in the marketing shell, with what to do next. */
const playUnavailable: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByRole('alert')).toHaveTextContent("We couldn't load the prices.")
  await expect(canvas.getByRole('banner')).toBeInTheDocument()
  await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
  await expect(retry).toHaveBeenCalled()
  const main = within(canvas.getByRole('main'))
  await expect(main.getByRole('link', { name: 'Try an example song' })).toBeVisible()
  await expect(main.queryByRole('link', { name: 'Go to library' })).toBeNull()
}
export const PricesFailed: Story = {
  render: unavailable(false),
  globals: DESKTOP,
  play: playUnavailable,
}
export const PricesFailedPhone: Story = {
  render: unavailable(false),
  globals: { ...PHONE, ...DAYLIGHT },
  play: playUnavailable,
}
