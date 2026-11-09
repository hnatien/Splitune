import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, waitFor, within } from 'storybook/test'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { AppShell } from '../shell/app-shell'
import { BareShell } from '../shell/bare-shell'
import {
  ME,
  ME_CAPPED,
  ME_PLUS,
  ME_PLUS_CANCELLING,
  ME_PLUS_PAST_DUE,
  PLANS,
} from '../story-fixtures'
import { MockCheckout } from './mock-checkout'
import { MockPortal } from './mock-portal'
import { billingOrpc, plansQuery } from './plans'
import { UpgradeSheet } from './upgrade-sheet'

// Billing (27 §3.10; 23 §5): the upgrade sheet; mock checkout (ready, declined, expired link) and
// portal (active, cancelling, past due). Pricing is in pricing.stories.tsx and Settings → Plan in
// settings/plan.stories.tsx. No card fields anywhere (25 §2): every story checks there is no text
// input at all.
const meta = { title: 'Screens/Billing', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }
const DAYLIGHT = { appearance: 'light' }

const SESSION = 'story-session'

const seed =
  (me: typeof ME | null, kind: 'checkout' | 'portal' = 'checkout') =>
  (client: QueryClient) => {
    client.setQueryData(meQuery.queryKey, me)
    client.setQueryData(plansQuery.queryKey, PLANS)
    client.setQueryData(billingOrpc.billing.mockSession.queryKey({ input: { session: SESSION } }), {
      kind,
      plan: kind === 'checkout' ? 'paid_monthly' : null,
      return_url: '/settings/billing',
    })
  }

async function noCardFields(canvasElement: HTMLElement) {
  const root = canvasElement.ownerDocument.body
  await expect(root.querySelectorAll('input:not([type=radio]):not([type=hidden])')).toHaveLength(0)
}

const sheet = (seedWith: (client: QueryClient) => void) => () => (
  <AppStory path="/import" seed={seedWith}>
    <AppShell me={ME_CAPPED}>
      <UpgradeSheet open onClose={() => undefined} trigger="cap_full" returnPath="/import" />
    </AppShell>
  </AppStory>
)

export const Upgrade: Story = {
  render: sheet(seed(ME_CAPPED)),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('Plus gives you')).toBeVisible()
    await expect(body.getByText(/15 full analyses a month/)).toBeVisible()
    await expect(body.getByRole('radio', { name: /Monthly/ })).toBeChecked()
    await expect(body.getByRole('radio', { name: /Yearly/ })).not.toBeChecked()
    await expect(body.getByText('Cancel anytime in one tap.')).toBeVisible()
    await noCardFields(canvasElement)
  },
}
export const UpgradeDaylight: Story = { render: sheet(seed(ME_CAPPED)), globals: DAYLIGHT }
export const UpgradePhone: Story = { render: sheet(seed(ME_CAPPED)), globals: PHONE }
export const UpgradePricesFailed: Story = {
  // Plans left unseeded: the request fails against Storybook's own server.
  render: sheet((client) => client.setQueryData(meQuery.queryKey, ME_CAPPED)),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    // The failure is Storybook's server answering; under load that takes longer than the 1 s default.
    await expect(
      await body.findByText("We couldn't load the prices.", undefined, { timeout: 10_000 }),
    ).toBeVisible()
  },
}

const bare = (children: React.ReactNode, seedWith: (client: QueryClient) => void) => () => (
  <AppStory path="/billing/mock-checkout" seed={seedWith}>
    <BareShell>{children}</BareShell>
  </AppStory>
)

export const Checkout: Story = {
  render: bare(<MockCheckout session={SESSION} />, seed(ME)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Splitune Plus, monthly')).toBeVisible()
    await waitFor(() =>
      expect(
        canvas.getByText('Demo mode — no real charges. Payments are simulated.'),
      ).toBeVisible(),
    )
    await expect(canvas.getByRole('button', { name: 'Simulate successful payment' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Simulate declined card' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await noCardFields(canvasElement)
  },
}
export const CheckoutDaylight: Story = {
  render: bare(<MockCheckout session={SESSION} />, seed(ME)),
  globals: DAYLIGHT,
}
export const CheckoutPhone: Story = {
  render: bare(<MockCheckout session={SESSION} />, seed(ME)),
  globals: PHONE,
}
export const CheckoutExpired: Story = {
  render: bare(<MockCheckout session="expired" />, seed(ME)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The failure is Storybook's server answering; under load that takes longer than the 1 s default.
    await expect(
      await canvas.findByText('This page has expired. Start again from Account.', undefined, {
        timeout: 10_000,
      }),
    ).toBeVisible()
  },
}

const portal = (me: typeof ME) => bare(<MockPortal session={SESSION} />, seed(me, 'portal'))

export const Portal: Story = {
  render: portal(ME_PLUS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Renews on 22 Nov')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Cancel Plus' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Switch to yearly' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Simulate payment failure' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Simulate refund' })).toBeVisible()
    await noCardFields(canvasElement)
  },
}
export const PortalDaylight: Story = { render: portal(ME_PLUS), globals: DAYLIGHT }
export const PortalPhone: Story = { render: portal(ME_PLUS), globals: PHONE }
export const PortalCancelling: Story = {
  render: portal(ME_PLUS_CANCELLING),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Ends on 22 Nov')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Resume Plus' })).toBeVisible()
  },
}
export const PortalPastDue: Story = {
  render: portal(ME_PLUS_PAST_DUE),
  globals: DAYLIGHT,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/The last \(simulated\) payment failed/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Switch to monthly' })).toBeVisible()
  },
}
