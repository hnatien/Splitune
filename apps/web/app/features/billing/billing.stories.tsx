import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { SettingsLayout } from '../settings/settings-layout'
import { AppShell } from '../shell/app-shell'
import { BareShell } from '../shell/bare-shell'
import { MarketingShell } from '../shell/marketing-shell'
import {
  ME,
  ME_CAPPED,
  ME_PLUS,
  ME_PLUS_CANCELLING,
  ME_PLUS_PAST_DUE,
  PLANS,
} from '../story-fixtures'
import { BillingSettings } from './billing-settings'
import { MockCheckout } from './mock-checkout'
import { MockPortal } from './mock-portal'
import { billingOrpc, plansQuery } from './plans'
import { PricingPage } from './pricing-page'
import { UpgradeSheet } from './upgrade-sheet'

// Plans and billing (27 §3.2, §3.9, §3.10; 23 §5): pricing signed out, on Free and on Plus; the
// upgrade sheet; mock checkout (ready, declined, expired link) and portal (active, cancelling,
// past due); Settings → Plan & billing for Free, Plus and the checkout return states. No card
// fields anywhere (25 §2): every story checks there is no text input at all.
const meta = { title: 'Screens/Billing', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

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

const pricing = (me: typeof ME | null) => () => (
  <AppStory path="/pricing" seed={seed(me)}>
    <MarketingShell signedIn={me !== null}>
      <PricingPage me={me} plans={PLANS} />
    </MarketingShell>
  </AppStory>
)

export const PricingSignedOut: Story = {
  render: pricing(null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const demo = await canvas.findByText('Demo mode — no real charges.')
    await waitFor(() => expect(demo).toBeVisible())
    // Both prices side by side; monthly chosen, yearly not emphasised (23 §5).
    await expect(canvas.getByRole('radio', { name: /Monthly/ })).toBeChecked()
    await expect(canvas.getByText('$9.99 a month')).toBeVisible()
    await expect(canvas.getByText('$79.99 a year')).toBeVisible()
    await userEvent.click(canvas.getByRole('radio', { name: /Yearly/ }))
    await expect(canvas.getByRole('radio', { name: /Yearly/ })).toBeChecked()
    await expect(canvas.getByRole('rowheader', { name: /Slow down to 50/ })).toBeVisible()
    await expect(canvas.queryByText(/most popular/i)).toBeNull()
    await noCardFields(canvasElement)
  },
}
export const PricingDark: Story = { render: pricing(null), globals: { appearance: 'dark' } }
export const PricingOnFree: Story = {
  render: pricing(ME),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: 'Get Plus' })).toBeVisible()
    await expect(canvas.getByText('Your plan')).toBeVisible()
  },
}
export const PricingOnPlus: Story = {
  render: pricing(ME_PLUS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: 'Manage your plan' })).toBeVisible()
  },
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
export const UpgradeDark: Story = {
  render: sheet(seed(ME_CAPPED)),
  globals: { appearance: 'dark' },
}
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
    await waitFor(() => expect(canvas.getByText('Demo mode — no real charges.')).toBeVisible())
    await expect(canvas.getByRole('button', { name: 'Simulate successful payment' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Simulate declined card' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await noCardFields(canvasElement)
  },
}
export const CheckoutDark: Story = {
  render: bare(<MockCheckout session={SESSION} />, seed(ME)),
  globals: { appearance: 'dark' },
}
export const CheckoutExpired: Story = {
  render: bare(<MockCheckout session="expired" />, seed(ME)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The failure is Storybook's server answering; under load that takes longer than the 1 s default.
    await expect(
      await canvas.findByText(
        'This page has expired. Start again from Plan & billing.',
        undefined,
        {
          timeout: 10_000,
        },
      ),
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
  globals: { appearance: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/The last \(simulated\) payment failed/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Switch to monthly' })).toBeVisible()
  },
}

const settings = (me: typeof ME, checkout?: 'success' | 'cancelled') => () => (
  <AppStory path="/settings/billing" seed={seed(me)}>
    <AppShell me={me}>
      <SettingsLayout>
        <BillingSettings me={me} checkout={checkout} />
      </SettingsLayout>
    </AppShell>
  </AppStory>
)

export const SettingsFree: Story = {
  render: settings(ME),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Your Welcome analysis is still unused.')).toBeVisible()
    await expect(canvas.getAllByText('4 of 5 Lite analyses left · resets 1 Dec')[0]).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'See Plus' })).toBeVisible()
  },
}
export const SettingsPlus: Story = {
  render: settings(ME_PLUS, 'success'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("You're on Plus. 15 full analyses a month, resets 22 Nov."),
    ).toBeVisible()
    await expect(
      canvas.getAllByText('12 of 15 full analyses left · resets 22 Nov')[0],
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Cancel Plus' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Manage plan' })).toBeVisible()
  },
}
export const SettingsPlusDark: Story = {
  render: settings(ME_PLUS),
  globals: { appearance: 'dark' },
}
export const SettingsCancelling: Story = {
  render: settings(ME_PLUS_CANCELLING),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Ends on 22 Nov')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Resume Plus' })).toBeVisible()
  },
}
export const SettingsCheckoutCancelled: Story = {
  render: settings(ME, 'cancelled'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Checkout cancelled. Nothing was charged.')).toBeVisible()
  },
}
