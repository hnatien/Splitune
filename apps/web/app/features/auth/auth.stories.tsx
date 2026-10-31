import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { AuthShell } from './auth-shell'
import { LinkLanding } from './link-landing'
import { CheckEmail, EmailForm } from './sign-in'

// Auth screens (27 §3.4) in the auth shell: sign in or create an account, field error, Google when
// configured, "Check your email" with the resend countdown and the dev-only Mailpit link, the
// magic-link landing's expired and invalid states, and the phone layout without the showcase.
const meta = { title: 'Screens/Auth', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const noop = () => undefined
const bare = (children: React.ReactNode) => (
  <AppStory path="/auth/sign-in">
    <AuthShell>{children}</AuthShell>
  </AppStory>
)

export const SignIn: Story = {
  render: () => bare(<EmailForm next="/library" google={false} onSent={noop} />),
}
export const SignInPhone: Story = {
  render: () => bare(<EmailForm next="/library" google={false} onSent={noop} />),
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}
export const SignInWithGoogle: Story = {
  render: () => bare(<EmailForm next="/library" google onSent={noop} />),
  globals: { appearance: 'dark' },
}
export const InvalidEmail: Story = {
  render: () => bare(<EmailForm next="/library" google={false} onSent={noop} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Email'), 'ana@')
    await userEvent.click(canvas.getByRole('button', { name: 'Email me a link' }))
    await expect(canvas.getByText(/Enter an email address/)).toBeVisible()
    await expect(canvas.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  },
}
export const CheckYourEmail: Story = {
  render: () =>
    bare(
      <CheckEmail
        email="ana@splitune.localhost"
        next="/library"
        mailpitUrl="http://localhost:8025"
        onDifferent={noop}
      />,
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/It works for 5 minutes/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Use a different email' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^Resend in/ })).toBeDisabled()
  },
}
export const CheckYourEmailStage: Story = {
  render: () =>
    bare(
      <CheckEmail
        email="ana@splitune.localhost"
        next="/library"
        mailpitUrl={undefined}
        onDifferent={noop}
      />,
    ),
  globals: { appearance: 'stage' },
}

const landing = (error?: string) => () => (
  <AppStory path="/auth/verify">
    <AuthShell>
      <LinkLanding error={error} />
    </AuthShell>
  </AppStory>
)

/** Expired, already used or unknown link (Better Auth: INVALID_TOKEN). */
export const LinkExpired: Story = {
  render: landing('INVALID_TOKEN'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText('This link has expired. We can send a new one.'),
    ).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Send a new link' })).toBeVisible()
  },
}
export const LinkInvalid: Story = { render: landing('UNKNOWN') }
