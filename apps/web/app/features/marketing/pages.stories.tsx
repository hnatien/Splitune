import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { MarketingShell } from '../shell/marketing-shell'
import { HowItWorks } from './how-it-works'
import { LegalPage } from './legal-page'

// How it works and the legal pages (27 §3.2) in the marketing shell.
const meta = { title: 'Screens/Marketing', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const howItWorks = () => (
  <AppStory path="/how-it-works">
    <MarketingShell signedIn={false}>
      <HowItWorks />
    </MarketingShell>
  </AppStory>
)

export const HowItWorksPage: Story = {
  render: howItWorks,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { level: 1 })).toBeVisible()
    await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(5)
    const steps = within(canvas.getByRole('navigation', { name: 'Steps' })).getAllByRole('link')
    await expect(steps).toHaveLength(4)
    await expect(steps[1]).toHaveAttribute('href', '#how-step-2')
    await expect(canvasElement.querySelector('#how-step-2 h2')).toHaveTextContent(
      'We isolate your part',
    )
  },
}
export const HowItWorksDark: Story = { render: howItWorks, globals: { appearance: 'dark' } }
export const HowItWorksPhone: Story = {
  render: howItWorks,
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}

const legal = (page: 'terms' | 'privacy') => () => (
  <AppStory path={`/legal/${page}`}>
    <MarketingShell signedIn={false}>
      <LegalPage page={page} />
    </MarketingShell>
  </AppStory>
)

export const Terms: Story = {
  render: legal('terms'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('navigation', { name: 'On this page' })).toBeVisible()
    await expect(canvas.getByText(/Last updated/)).toBeVisible()
  },
}
export const Privacy: Story = { render: legal('privacy') }
export const PrivacyDark: Story = { render: legal('privacy'), globals: { appearance: 'dark' } }
