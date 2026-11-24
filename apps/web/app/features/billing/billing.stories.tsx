import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, waitFor, within } from 'storybook/test'
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

// Billing (27 §3.10; 23 §5): the upgrade sheet (a dialog on wide screens, a sheet on phones); mock
// checkout (ready, expired link) and portal (active, cancelling, past due), in Dark and Light at
// 1440, 768 and 375. Pricing is in pricing.stories.tsx and Settings → Plan in
// settings/plan.stories.tsx. No card fields anywhere (25 §2): every story checks there is no text
// input at all.
const meta = {
  title: 'Screens/Billing',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
type Play = NonNullable<Story['play']>

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

/** What Plus adds, the two prices as equal rows, then Continue with Not now after it. */
const playUpgrade =
  (layer: 'dialog-content' | 'drawer-popup'): Play =>
  async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole('dialog', { name: 'Plus gives you' })
    await waitFor(() => expect(dialog).toBeVisible())
    await expect(dialog).toHaveAttribute('data-slot', layer)
    const inside = within(dialog)
    await expect(inside.getByText(/15 full analyses a month/)).toBeVisible()
    await expect(inside.getByRole('radio', { name: /Monthly/ })).toBeChecked()
    await expect(inside.getByRole('radio', { name: /Yearly/ })).not.toBeChecked()
    await expect(inside.getByText('Cancel anytime in one tap.')).toBeVisible()
    // A visible way to close, and the choice is followed by the action, then Not now.
    await expect(inside.getByRole('button', { name: 'Close' })).toBeVisible()
    const order = inside
      .getAllByRole('button')
      .map((button) => button.textContent?.trim())
      .filter((text) => text === 'Continue to checkout' || text === 'Not now')
    await expect(order).toEqual(['Continue to checkout', 'Not now'])
    await expect(filledControls(dialog)).toHaveLength(1)
    await noCardFields(canvasElement)
  }

export const Upgrade: Story = {
  render: sheet(seed(ME_CAPPED)),
  globals: DESKTOP,
  play: playUpgrade('dialog-content'),
}
export const UpgradeDaylight: Story = {
  render: sheet(seed(ME_CAPPED)),
  globals: { ...TABLET, ...DAYLIGHT },
  play: playUpgrade('dialog-content'),
}
export const UpgradePhone: Story = {
  render: sheet(seed(ME_CAPPED)),
  globals: PHONE,
  play: playUpgrade('drawer-popup'),
}
export const UpgradePricesFailed: Story = {
  // Plans left unseeded: the request fails against Storybook's own server.
  render: sheet((client) => client.setQueryData(meQuery.queryKey, ME_CAPPED)),
  globals: { ...DESKTOP, appearance: 'dark' },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    // The failure is Storybook's server answering; under load that takes longer than the 1 s default.
    const failed = await body.findByText("We couldn't load the prices.", undefined, {
      timeout: 10_000,
    })
    // It can land while the dialog is still fading in (seen in WebKit).
    await waitFor(() => expect(failed).toBeVisible())
    // What Plus adds stays, and Continue says why it can't be used yet.
    await expect(body.getByText('Priority processing')).toBeVisible()
    await expect(body.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(
      body.getByRole('button', {
        name: /^Continue to checkout.*Unavailable until the prices load$/,
      }),
    ).toBeDisabled()
  },
}
export const UpgradePricesFailedDaylight: Story = {
  ...UpgradePricesFailed,
  globals: { ...DESKTOP, ...DAYLIGHT },
}

const bare = (children: React.ReactNode, seedWith: (client: QueryClient) => void) => () => (
  <AppStory path="/billing/mock-checkout" seed={seedWith}>
    <BareShell>{children}</BareShell>
  </AppStory>
)

const playCheckout: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByText('Splitune Plus, monthly')).toBeVisible()
  await waitFor(() =>
    expect(canvas.getByText('Demo mode — no real charges. Payments are simulated.')).toBeVisible(),
  )
  // The three outcomes ranked by weight: success is the one filled control.
  const filled = filledControls(canvasElement)
  await expect(filled).toHaveLength(1)
  await expect(filled[0]).toHaveAccessibleName('Simulate successful payment')
  await expect(canvas.getByRole('button', { name: 'Simulate declined card' })).toBeVisible()
  await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeVisible()
  // Space between the parts, not a rule under every one of them.
  await expect(canvasElement.querySelectorAll('main .border-t')).toHaveLength(0)
  await noCardFields(canvasElement)
  await noSidewaysScroll(canvasElement)
}

export const Checkout: Story = {
  render: bare(<MockCheckout session={SESSION} />, seed(ME)),
  globals: DESKTOP,
  play: playCheckout,
}
export const CheckoutDaylight: Story = {
  render: bare(<MockCheckout session={SESSION} />, seed(ME)),
  globals: { ...TABLET, ...DAYLIGHT },
  play: playCheckout,
}
export const CheckoutPhone: Story = {
  render: bare(<MockCheckout session={SESSION} />, seed(ME)),
  globals: PHONE,
  play: playCheckout,
}

const playExpired =
  (signedIn: boolean): Play =>
  async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The failure is Storybook's server answering; under load that takes longer than the 1 s default.
    await expect(
      await canvas.findByText('This link has expired.', undefined, { timeout: 10_000 }),
    ).toBeVisible()
    if (signedIn) {
      await expect(canvas.getByRole('link', { name: 'Go to Plan' })).toHaveAttribute(
        'href',
        '/settings/plan',
      )
    } else {
      // A visitor who isn't signed in is told to sign in, not bounced there unexplained.
      await expect(canvas.getByText(/^Sign in, then start again/)).toBeVisible()
      await expect(canvas.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
        'href',
        '/auth/sign-in?next=%2Fsettings%2Fplan',
      )
    }
  }

export const CheckoutExpired: Story = {
  render: bare(<MockCheckout session="expired" />, seed(ME)),
  globals: DESKTOP,
  play: playExpired(true),
}
export const CheckoutExpiredSignedOut: Story = {
  render: bare(<MockCheckout session="expired" />, seed(null)),
  globals: { ...PHONE, ...DAYLIGHT },
  play: playExpired(false),
}

const portal = (me: typeof ME) => bare(<MockPortal session={SESSION} />, seed(me, 'portal'))

/** Cancelling is an outline button, after switching: an active subscription leaves nothing
 * filled. Back to Plan lines up with the column's text. */
const playPortal: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByText('Renews on 22 Nov')).toBeVisible()
  const cancel = canvas.getByRole('button', { name: 'Cancel Plus' })
  await expect(cancel).toBeVisible()
  await expect(filledControls(canvasElement)).toHaveLength(0)
  const change = canvas.getByRole('button', { name: 'Switch to yearly' })
  await expect(change).toBeVisible()
  await expect(change.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  )
  const back = canvas.getByRole('link', { name: 'Back to Plan' })
  const label = document.createRange()
  label.selectNodeContents(back)
  const title = canvas.getByRole('heading', { level: 1 }).getBoundingClientRect()
  await expect(Math.abs(label.getBoundingClientRect().left - title.left)).toBeLessThanOrEqual(1)
  const simulations = within(canvas.getByRole('region', { name: 'Simulations' }))
  await expect(simulations.getByRole('button', { name: 'Simulate payment failure' })).toBeVisible()
  await expect(simulations.getByRole('button', { name: 'Simulate refund' })).toBeVisible()
  await expect(canvas.getByRole('link', { name: 'Back to Plan' })).toHaveAttribute(
    'href',
    '/settings/billing',
  )
  await noCardFields(canvasElement)
  await noSidewaysScroll(canvasElement)
}

export const Portal: Story = { render: portal(ME_PLUS), globals: DESKTOP, play: playPortal }
export const PortalDaylight: Story = {
  render: portal(ME_PLUS),
  globals: { ...TABLET, ...DAYLIGHT },
  play: playPortal,
}
export const PortalPhone: Story = { render: portal(ME_PLUS), globals: PHONE, play: playPortal }
export const PortalCancelling: Story = {
  render: portal(ME_PLUS_CANCELLING),
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Ends on 22 Nov')).toBeVisible()
    const filled = filledControls(canvasElement)
    await expect(filled).toHaveLength(1)
    await expect(filled[0]).toHaveAccessibleName('Resume Plus')
  },
}
export const PortalPastDue: Story = {
  render: portal(ME_PLUS_PAST_DUE),
  globals: { ...PHONE, appearance: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const line = await canvas.findByText(/The last \(simulated\) payment failed/)
    // A failed payment carries the warning glyph, never the success check.
    const message = line.closest('[data-slot=inline-error]')
    await expect(message).toHaveAttribute('data-tone', 'warning')
    await expect(canvas.getByRole('button', { name: 'Switch to monthly' })).toBeVisible()
  },
}
export const PortalPastDueDaylight: Story = {
  ...PortalPastDue,
  globals: { ...PHONE, ...DAYLIGHT },
}
