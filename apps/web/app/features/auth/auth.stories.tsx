import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { AuthShell } from './auth-shell'
import { AuthScreen } from './sign-in'

// Auth screens (27 §3.4, `SignIn.dc.html`) in the auth shell, in both themes: sign in and create an
// account with a username and a password, the field errors, Google when configured, the showcase
// from `lg`, and the phone layout without it.
const meta = { title: 'Screens/Auth', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const screen =
  (mode: 'sign-in' | 'sign-up', google = false) =>
  () => (
    <AppStory path={mode === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up'}>
      <AuthShell>
        <AuthScreen mode={mode} next="/library" google={google} />
      </AuthShell>
    </AppStory>
  )

export const SignIn: Story = {
  render: screen('sign-in'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByLabelText('Username')).toHaveAttribute(
      'autocomplete',
      'username',
    )
    await expect(canvas.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    await expect(canvas.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/auth/sign-up?next=%2Flibrary',
    )
    await expect(canvas.getByText(/No email needed\./)).toBeVisible()
    // The showcase (27 §3.4), shown from lg: what an account keeps, beside the form.
    await expect(
      canvas.getByRole('heading', {
        name: 'Your loops, speeds and fixes stay with every song.',
        hidden: true,
      }),
    ).toBeInTheDocument()
    // No Google button unless it is configured.
    await expect(canvas.queryByRole('button', { name: 'Continue with Google' })).toBeNull()
  },
}
export const SignInDaylight: Story = { render: screen('sign-in'), globals: { appearance: 'light' } }
export const SignInPhone: Story = {
  render: screen('sign-in'),
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Phones get the form alone.
    await expect(await canvas.findByLabelText('Username')).toBeVisible()
    await expect(canvas.queryByRole('heading', { level: 2 })).toBeNull()
  },
}
export const SignInWithGoogle: Story = {
  render: screen('sign-in', true),
  globals: { appearance: 'dark' },
}
/** Submitting empty fields names both. */
export const SignInMissing: Story = {
  render: screen('sign-in'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Sign in' }))
    await expect(canvas.getByText('Enter your username.')).toBeVisible()
    await expect(canvas.getByText('Enter your password.')).toBeVisible()
    await expect(canvas.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true')
  },
}

export const SignUp: Story = {
  render: screen('sign-up'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/3–30 letters, numbers/)).toBeVisible()
    await expect(canvas.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    await expect(canvas.getByRole('link', { name: 'Sign in' })).toBeVisible()
  },
}
export const SignUpDaylight: Story = { render: screen('sign-up'), globals: { appearance: 'light' } }
export const SignUpPhone: Story = {
  render: screen('sign-up'),
  globals: { appearance: 'light', viewport: { value: 'mobile2', isRotated: false } },
}
/** A username with a space and a short password, each with its own error. */
export const SignUpInvalid: Story = {
  render: screen('sign-up'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Username'), 'ana b')
    await userEvent.type(canvas.getByLabelText('Password'), 'short')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(canvas.getByText(/^Use 3–30 letters/)).toBeVisible()
    await expect(canvas.getByText('Use at least 8 characters.')).toBeVisible()
    await expect(canvas.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  },
}
