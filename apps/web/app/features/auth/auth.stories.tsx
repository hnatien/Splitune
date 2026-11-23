import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
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
import { AuthShell } from './auth-shell'
import { AuthScreen } from './sign-in'

// Auth screens (27 §3.4) in the auth shell, in Dark and Light at 1440, 768 and 375: sign in and
// create an account with a username and a password, the field errors (focus moves to the first),
// Google when configured, and the way to the example song for whoever arrived by mistake. One
// column on every screen size.
const meta = {
  title: 'Screens/Auth',
  parameters: { layout: 'fullscreen', viewport: { options: VIEWPORTS } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
type Play = NonNullable<Story['play']>

const screen =
  (mode: 'sign-in' | 'sign-up', google = false) =>
  () => (
    <AppStory path={mode === 'sign-in' ? '/auth/sign-in' : '/auth/sign-up'}>
      <AuthShell>
        <AuthScreen mode={mode} next="/library" google={google} />
      </AuthShell>
    </AppStory>
  )

const playSignIn: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByLabelText('Username')).toHaveAttribute('autocomplete', 'username')
  await expect(canvas.getByLabelText('Password')).toHaveAttribute(
    'autocomplete',
    'current-password',
  )
  // The way to the other mode is a full-size target, not an 18 px inline link.
  const other = canvas.getByRole('link', { name: 'Create an account' })
  await expect(other).toHaveAttribute('href', '/auth/sign-up?next=%2Flibrary')
  await expect(other.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  await expect(canvas.getByText('No email needed.')).toBeVisible()
  // One heading, the form alone and one filled control: no panel beside it, even on a wide screen.
  await expect(canvas.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(canvas.queryByRole('complementary', { hidden: true })).toBeNull()
  await expect(filledControls(canvasElement)).toHaveLength(1)
  await expect(canvas.getByRole('link', { name: 'Try an example song' })).toHaveAttribute(
    'href',
    '/start',
  )
  // No Google button unless it is configured.
  await expect(canvas.queryByRole('button', { name: 'Continue with Google' })).toBeNull()
  await noSidewaysScroll(canvasElement)
}

export const SignIn: Story = { render: screen('sign-in'), globals: DESKTOP, play: playSignIn }
export const SignInDaylight: Story = {
  render: screen('sign-in'),
  globals: { ...DESKTOP, ...DAYLIGHT },
  play: playSignIn,
}
export const SignInTablet: Story = { render: screen('sign-in'), globals: TABLET, play: playSignIn }
export const SignInPhone: Story = { render: screen('sign-in'), globals: PHONE, play: playSignIn }
export const SignInWithGoogle: Story = {
  render: screen('sign-in', true),
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const google = await within(canvasElement).findByRole('button', {
      name: 'Continue with Google',
    })
    await expect(google).toBeVisible()
    await expect(filledControls(canvasElement)).toHaveLength(1)
  },
}

/** Submitting empty fields names both and puts focus on the first. */
const playMissing: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(await canvas.findByRole('button', { name: 'Sign in' }))
  await expect(canvas.getByText('Enter your username.')).toBeVisible()
  await expect(canvas.getByText('Enter your password.')).toBeVisible()
  const username = canvas.getByLabelText('Username')
  await expect(username).toHaveAttribute('aria-invalid', 'true')
  await expect(username).toHaveAccessibleDescription('Enter your username.')
  await waitFor(() => expect(username).toHaveFocus())
}
export const SignInMissing: Story = {
  render: screen('sign-in'),
  globals: DESKTOP,
  play: playMissing,
}
export const SignInMissingPhone: Story = {
  render: screen('sign-in'),
  globals: { ...PHONE, ...DAYLIGHT },
  play: playMissing,
}

/** Only the password is missing: focus goes to it, the username stays valid. */
export const SignInPasswordMissing: Story = {
  render: screen('sign-in'),
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Username'), 'ana')
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(canvas.getByLabelText('Password')).toHaveFocus())
    await expect(canvas.getByLabelText('Username')).not.toHaveAttribute('aria-invalid')
  },
}

const playSignUp: Play = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(await canvas.findByText(/3–30 letters, numbers/)).toBeVisible()
  await expect(canvas.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  await expect(canvas.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/auth/sign-in?next=%2Flibrary',
  )
  await noSidewaysScroll(canvasElement)
}
export const SignUp: Story = { render: screen('sign-up'), globals: DESKTOP, play: playSignUp }
export const SignUpDaylight: Story = {
  render: screen('sign-up'),
  globals: { ...TABLET, ...DAYLIGHT },
  play: playSignUp,
}
export const SignUpPhone: Story = {
  render: screen('sign-up'),
  globals: { ...PHONE, ...DAYLIGHT },
  play: playSignUp,
}

/** A username with a space and a short password, each with its own error; focus on the first. */
export const SignUpInvalid: Story = {
  render: screen('sign-up'),
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Username'), 'ana b')
    await userEvent.type(canvas.getByLabelText('Password'), 'short')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(canvas.getByText(/^Use 3–30 letters/)).toBeVisible()
    await expect(canvas.getByText('Use at least 8 characters.')).toBeVisible()
    await expect(canvas.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(canvas.getByLabelText('Username')).toHaveFocus())
  },
}
