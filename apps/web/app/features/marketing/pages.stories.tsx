import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { MarketingShell } from '../shell/marketing-shell'
import { NotFoundMessage } from '../system/error-page'
import { HowItWorks } from './how-it-works'
import { LegalPage } from './legal-page'
import {
  DAYLIGHT,
  DESKTOP,
  expectReadablePictures,
  filledControls,
  noSidewaysScroll,
  PHONE,
  TABLET,
  VIEWPORTS,
} from './story-checks'

// How it works and the legal pages (27 §3.2) in the marketing shell, in Dark and Light, at 1440,
// 768 and 375; and a page that doesn't exist, which keeps the shell.
const meta = {
  title: 'Screens/Marketing',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
type Play = NonNullable<Story['play']>

const howItWorks = () => (
  <AppStory path="/how-it-works">
    <MarketingShell signedIn={false}>
      <HowItWorks />
    </MarketingShell>
  </AppStory>
)

const playHowItWorks: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByRole('heading', { level: 1, name: 'How it works' })).toBeVisible()
  await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(5)
  const steps = within(canvas.getByRole('navigation', { name: 'Steps' })).getAllByRole('link')
  await expect(steps).toHaveLength(4)
  await expect(steps[1]).toHaveAccessibleName('Isolate')
  await expect(steps[1]).toHaveAttribute('href', '#how-step-2')
  await expect(canvasElement.querySelector('#how-step-2 h2')).toHaveTextContent(
    'We isolate your part',
  )
  // Every picture is one image with a text alternative.
  await expect(canvas.getAllByRole('img')).toHaveLength(4)
  await expect(canvas.getByRole('img', { name: /guitar marked as your part/ })).toBeInTheDocument()
  // Uncertainty in frequencies, never a percentage (27 §5.3).
  await expect(canvas.getByText(/about 1 in 8 is marked unsure/)).toBeVisible()
  await expect(filledControls(canvasElement)).toHaveLength(1)
  // The page you are on is marked in the footer (and the bar, from `sm`).
  const here = within(canvas.getByRole('navigation', { name: 'Footer' })).getByRole('link', {
    name: 'How it works',
  })
  await expect(here).toHaveAttribute('aria-current', 'page')
  await expectReadablePictures(canvasElement)
  await noSidewaysScroll(canvasElement)
}

/** Reading a step marks it in the step links with the ink edge; the links stay under the bar, so
 * the mark is in view, and a step reached by its link starts below them, its heading uncovered. */
const playCurrentStep: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const steps = await canvas.findByRole('navigation', { name: 'Steps' })
  const nav = within(steps)
  const step = canvasElement.ownerDocument.getElementById('how-step-3') as HTMLElement
  step.scrollIntoView({ block: 'start' })
  await waitFor(() =>
    expect(nav.getByRole('link', { name: 'Transcribe' })).toHaveAttribute('aria-current', 'step'),
  )
  const transcribe = nav.getByRole('link', { name: 'Transcribe' })
  await expect(nav.getByRole('link', { name: 'Isolate' })).not.toHaveAttribute('aria-current')
  const bar = (canvasElement.querySelector('header') as HTMLElement).getBoundingClientRect()
  const held = steps.getBoundingClientRect()
  await expect(held.top).toBeGreaterThanOrEqual(bar.bottom - 1)
  await expect(held.top).toBeLessThanOrEqual(bar.bottom + 1)
  const mark = transcribe.getBoundingClientRect()
  await expect(mark.left).toBeGreaterThanOrEqual(0)
  await expect(mark.right).toBeLessThanOrEqual(window.innerWidth)
  const heading = (step.querySelector('h2') as HTMLElement).getBoundingClientRect()
  await expect(heading.top).toBeGreaterThanOrEqual(held.bottom)
}

export const HowItWorksPage: Story = { render: howItWorks, globals: DESKTOP, play: playHowItWorks }
export const HowItWorksDaylight: Story = {
  render: howItWorks,
  globals: { ...DESKTOP, ...DAYLIGHT },
  play: playHowItWorks,
}
export const HowItWorksTablet: Story = {
  render: howItWorks,
  globals: TABLET,
  play: playHowItWorks,
}
export const HowItWorksPhone: Story = { render: howItWorks, globals: PHONE, play: playHowItWorks }
export const HowItWorksPhoneDaylight: Story = {
  render: howItWorks,
  globals: { ...PHONE, ...DAYLIGHT },
  play: playHowItWorks,
}
export const HowItWorksCurrentStep: Story = {
  render: howItWorks,
  globals: DESKTOP,
  play: playCurrentStep,
}
export const HowItWorksCurrentStepDaylight: Story = {
  render: howItWorks,
  globals: { ...DESKTOP, ...DAYLIGHT },
  play: playCurrentStep,
}
export const HowItWorksCurrentStepPhone: Story = {
  render: howItWorks,
  globals: PHONE,
  play: playCurrentStep,
}

const legal = (page: 'terms' | 'privacy') => () => (
  <AppStory path={`/legal/${page}`}>
    <MarketingShell signedIn={false}>
      <LegalPage page={page} />
    </MarketingShell>
  </AppStory>
)

const playLegal: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const toc = within(await canvas.findByRole('navigation', { name: 'On this page' }))
  await expect(canvas.getByText(/^Last updated \d+ \w+ \d{4}$/)).toBeVisible()
  // Section heads are a step above the body, never the display size.
  const head = canvasElement.querySelector('article h2') as HTMLElement
  await expect(Number.parseFloat(getComputedStyle(head).fontSize)).toBeLessThan(24)
  // Reading a section marks it in the contents (scrolled to, as its link would).
  const last = toc.getAllByRole('link').at(-1) as HTMLElement
  const id = last.getAttribute('href')?.slice(1) ?? ''
  canvasElement.ownerDocument.getElementById(id)?.scrollIntoView({ block: 'start' })
  await waitFor(() => expect(last).toHaveAttribute('aria-current', 'location'))
  await expect(toc.getAllByRole('link')[0]).not.toHaveAttribute('aria-current')
  await noSidewaysScroll(canvasElement)
}

export const Terms: Story = { render: legal('terms'), globals: DESKTOP, play: playLegal }
export const Privacy: Story = {
  render: legal('privacy'),
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    // Sign-up asks for a username and a password, so the policy names no email address.
    await expect(
      await within(canvasElement).findByText(/^Your username, the songs you import/),
    ).toBeVisible()
    await expect(within(canvasElement).queryByText(/email/i)).toBeNull()
  },
}
export const PrivacyDaylight: Story = {
  render: legal('privacy'),
  globals: { ...TABLET, ...DAYLIGHT },
  play: playLegal,
}
export const TermsPhone: Story = { render: legal('terms'), globals: PHONE, play: playLegal }

const missing = () => (
  <AppStory path="/legal/nope">
    <MarketingShell signedIn={false}>
      <div className="mx-auto w-full max-w-bare px-4">
        <NotFoundMessage />
      </div>
    </MarketingShell>
  </AppStory>
)

/** An unknown legal page is a 404 that keeps the navigation, with a way home for visitors. */
const playMissing: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(
    await canvas.findByRole('heading', { level: 1, name: "We couldn't find that page." }),
  ).toBeVisible()
  await expect(canvas.getByRole('navigation', { name: 'Footer' })).toBeVisible()
  await expect(canvas.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
    'href',
    '/',
  )
  await expect(canvas.queryByRole('link', { name: 'Go to library' })).toBeNull()
}

export const LegalNotFound: Story = { render: missing, globals: DESKTOP, play: playMissing }
export const LegalNotFoundPhone: Story = {
  render: missing,
  globals: { ...PHONE, ...DAYLIGHT },
  play: playMissing,
}
