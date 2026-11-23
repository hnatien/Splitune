import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, within } from 'storybook/test'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { PlanSettings } from '../billing/billing-settings'
import { plansQuery } from '../billing/plans'
import { AppShell } from '../shell/app-shell'
import { ME, ME_CAPPED, ME_PLUS, ME_PLUS_CANCELLING, PLANS } from '../story-fixtures'
import { SettingsLayout } from './settings-layout'
import { UsageSettings } from './usage-settings'

// Settings → Plan (27 §3.9, §3.10): what is left as figures, then the plan, on Free, Plus and the
// checkout return states; Settings → Usage: the allowances and the plan they come from, on Free,
// Plus and at the limit.
const meta = { title: 'Screens/Settings/Plan', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const seed = (me: typeof ME) => (client: QueryClient) => {
  client.setQueryData(meQuery.queryKey, me)
  client.setQueryData(plansQuery.queryKey, PLANS)
}

const settings = (me: typeof ME, checkout?: 'success' | 'cancelled') => () => (
  <AppStory path="/settings/plan" seed={seed(me)}>
    <AppShell me={me}>
      <SettingsLayout>
        <PlanSettings me={me} checkout={checkout} />
      </SettingsLayout>
    </AppShell>
  </AppStory>
)

export const Free: Story = {
  render: settings(ME),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Plan' })).toBeVisible()
    await expect(canvas.getByText('Your Welcome analysis is still unused.')).toBeVisible()
    // Demo billing is said once, as words under the title, not a badge.
    await expect(canvas.getByText(/^Demo mode — no real charges/)).toBeVisible()
    await expect(canvasElement.querySelector('[data-slot=badge]')).toBeNull()
    // What is left is figures (26 §12.2 Stat); the bars are on Usage.
    const stats = [...canvasElement.querySelectorAll('[data-slot=stat]')].map((s) => s.textContent)
    await expect(stats).toEqual(['1 of 1Welcome analysis left', '4 of 5Lite analyses left'])
    await expect(canvas.queryByRole('meter')).toBeNull()
    await expect(canvas.getByRole('link', { name: 'See usage' })).toHaveAttribute(
      'href',
      '/settings/usage',
    )
    await expect(canvas.getByRole('button', { name: 'See Plus' })).toHaveAttribute(
      'data-variant',
      'primary',
    )
  },
}
export const Plus: Story = {
  render: settings(ME_PLUS, 'success'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("You're on Plus. 15 full analyses a month, resets 22 Nov."),
    ).toBeVisible()
    // Managing the plan is the everyday path; cancelling is there, one tap, but quieter.
    await expect(canvas.getByRole('button', { name: 'Manage plan' })).toHaveAttribute(
      'data-variant',
      'outline',
    )
    const cancel = canvas.getByRole('button', { name: 'Cancel Plus' })
    await expect(cancel).toHaveAttribute('data-variant', 'quiet')
    // The quiet Cancel follows Manage rather than starting the row.
    await expect(
      canvas.getByRole('button', { name: 'Manage plan' }).compareDocumentPosition(cancel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    await expect(canvas.getByText('12 of 15')).toBeVisible()
  },
}
export const PlusDaylight: Story = { render: settings(ME_PLUS), globals: { appearance: 'light' } }
export const Cancelling: Story = {
  render: settings(ME_PLUS_CANCELLING),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Ends on 22 Nov')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Resume Plus' })).toBeVisible()
  },
}
export const CheckoutCancelled: Story = {
  render: settings(ME, 'cancelled'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Checkout cancelled. Nothing was charged.')).toBeVisible()
  },
}

const usage = (me: typeof ME) => () => (
  <AppStory path="/settings/usage" seed={seed(me)}>
    <AppShell me={me}>
      <SettingsLayout>
        <UsageSettings me={me} />
      </SettingsLayout>
    </AppShell>
  </AppStory>
)

/** Free: Full is Plus', Lite has its bar and reset date, the Welcome analysis is unused. */
export const UsageFree: Story = {
  render: usage(ME),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Usage' })).toBeVisible()
    await expect(canvas.getByText('Part of Plus')).toBeVisible()
    const lite = canvas.getByRole('meter', { name: 'Lite analyses' })
    await expect(lite).toHaveAttribute('aria-valuetext', '1 of 5 used, Resets 1 Dec')
    await expect(canvas.getByText('1 of 5 used')).toBeVisible()
    await expect(canvas.getByRole('meter', { name: 'Welcome analysis' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    await expect(canvas.getByText('Free', { exact: true })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'View plan' })).toHaveAttribute(
      'href',
      '/settings/plan',
    )
    await expect(canvas.getByRole('button', { name: 'See Plus' })).toBeVisible()
  },
}
export const UsageFreeDaylight: Story = { render: usage(ME), globals: { appearance: 'light' } }
/** Every Lite analysis of the month used: the bar is full and says so in words. */
export const UsageLiteUsedUp: Story = {
  render: usage(ME_CAPPED),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('5 of 5 used')).toBeVisible()
    await expect(canvas.getByRole('meter', { name: 'Welcome analysis' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
  },
}
/** Plus: Full has its bar, Lite has no limit, no Welcome row, the renewal line and View plan. */
export const UsagePlus: Story = {
  render: usage(ME_PLUS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('3 of 15 used')).toBeVisible()
    await expect(canvas.getByText('12 used · no monthly limit')).toBeVisible()
    await expect(canvas.queryByRole('meter', { name: 'Welcome analysis' })).toBeNull()
    await expect(canvas.getByText('Renews on 22 Nov')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'See Plus' })).toBeNull()
    await expect(canvas.getByRole('link', { name: 'View plan' })).toBeVisible()
  },
}
export const UsagePlusDaylight: Story = { render: usage(ME_PLUS), globals: { appearance: 'light' } }
export const UsagePhone: Story = {
  render: usage(ME),
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument.documentElement
    await expect(await within(canvasElement).findByText('1 of 5 used')).toBeVisible()
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
  },
}
