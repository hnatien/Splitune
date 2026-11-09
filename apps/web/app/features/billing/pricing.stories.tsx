import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { MarketingShell } from '../shell/marketing-shell'
import { ME, ME_PLUS, PLANS } from '../story-fixtures'
import { plansQuery } from './plans'
import { PricingPage } from './pricing-page'

// Pricing (27 §3.2, `Pricing.dc.html`; 23 §5): signed out (Night Rehearsal, Daylight, phone), on
// Free and on Plus. No card fields anywhere (25 §2).
const meta = { title: 'Screens/Pricing', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }

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

const priceLine = (text: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent?.replace(/\s+/g, ' ').trim() === text

async function noSidewaysScroll({ canvasElement }: { canvasElement: HTMLElement }) {
  const root = canvasElement.ownerDocument.documentElement
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
  await noCardFields(canvasElement)
}

export const SignedOut: Story = {
  render: pricing(null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const demo = await canvas.findByText(/^Demo mode — no real charges\./)
    await waitFor(() => expect(demo).toBeVisible())
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Every practice tool is free' }),
    ).toBeVisible()
    // Monthly and yearly side by side, monthly chosen, neither emphasised (23 §5).
    const monthly = canvas.getByRole('button', { name: 'Monthly' })
    const yearly = canvas.getByRole('button', { name: 'Yearly' })
    await expect(monthly).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByText(priceLine('$9.99 a month · or $79.99 a year'))).toBeVisible()
    await userEvent.click(yearly)
    await expect(yearly).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByText(priceLine('$79.99 a year · or $9.99 a month'))).toBeVisible()
    await expect(canvas.getByRole('rowheader', { name: /Slow down to 25/ })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Get Plus' })).toBeVisible()
    await expect(canvas.queryByText(/most popular/i)).toBeNull()
    // Honesty gates (27 §3.2): nothing promised before its step ships.
    await expect(canvas.queryByText(/speed ladder|beat lights|Stand view|every stem/i)).toBeNull()
    await noCardFields(canvasElement)
  },
}
export const Daylight: Story = { render: pricing(null), globals: { appearance: 'light' } }
export const Phone: Story = { render: pricing(null), globals: PHONE, play: noSidewaysScroll }
export const PhoneDaylight: Story = {
  render: pricing(null),
  globals: { appearance: 'light', ...PHONE },
  play: noSidewaysScroll,
}
export const OnFree: Story = {
  render: pricing(ME),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: 'Get Plus' })).toBeVisible()
    await expect(canvas.getByText('Your plan')).toBeVisible()
  },
}
export const OnFreeDaylight: Story = { render: pricing(ME), globals: { appearance: 'light' } }
export const OnPlus: Story = {
  render: pricing(ME_PLUS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: 'Manage your plan' })).toBeVisible()
  },
}
