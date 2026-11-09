import type { Meta, StoryObj } from '@storybook/react-vite'
import type { QueryClient } from '@tanstack/react-query'
import { expect, within } from 'storybook/test'
import { meQuery } from '@/lib/session'
import { AppStory } from '../../../.storybook/app.tsx'
import { BillingSettings } from '../billing/billing-settings'
import { plansQuery } from '../billing/plans'
import { AppShell } from '../shell/app-shell'
import { ME, ME_PLUS, ME_PLUS_CANCELLING, PLANS } from '../story-fixtures'
import { SettingsLayout } from './settings-layout'

// Settings → Account → Plan (27 §3.9, §3.10): Free, Plus and the checkout return states.
const meta = { title: 'Screens/Settings/Plan', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const seed = (me: typeof ME) => (client: QueryClient) => {
  client.setQueryData(meQuery.queryKey, me)
  client.setQueryData(plansQuery.queryKey, PLANS)
}

const settings = (me: typeof ME, checkout?: 'success' | 'cancelled') => () => (
  <AppStory path="/settings/account" seed={seed(me)}>
    <AppShell me={me}>
      <SettingsLayout>
        <BillingSettings me={me} checkout={checkout} />
      </SettingsLayout>
    </AppShell>
  </AppStory>
)

export const Free: Story = {
  render: settings(ME),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Your Welcome analysis is still unused.')).toBeVisible()
    await expect(canvas.getByText('Lite analyses')).toBeVisible()
    await expect(canvas.getByText('4 of 5 left · resets 1 Dec')).toBeVisible()
    await expect(canvas.getByText('Demo billing')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'See Plus' })).toBeVisible()
  },
}
export const Plus: Story = {
  render: settings(ME_PLUS, 'success'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("You're on Plus. 15 full analyses a month, resets 22 Nov."),
    ).toBeVisible()
    await expect(canvas.getByText('Full analyses')).toBeVisible()
    await expect(canvas.getByText('12 of 15 left · resets 22 Nov')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Cancel Plus' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Manage plan' })).toBeVisible()
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
