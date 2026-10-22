import type { Meta, StoryObj } from '@storybook/react-vite'
import { KeyboardIcon } from 'lucide-react'
import { expect, userEvent, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { AppShell } from '../shell/app-shell'
import { ME } from '../story-fixtures'
import { DisplaySettings } from './display-settings'
import { KeyboardSettings } from './keyboard-settings'
import { SettingsPlaceholder } from './placeholder'
import { ProfileSettings } from './profile-settings'

// Settings sections (27 §3.9): Profile and Display & practice; placeholders for later steps.
const meta = { title: 'Screens/Settings', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const shell = (children: React.ReactNode) => (
  <AppStory path="/settings/profile">
    <AppShell me={ME}>
      <div className="max-w-2xl">{children}</div>
    </AppShell>
  </AppStory>
)

export const Profile: Story = {
  render: () => shell(<ProfileSettings me={ME} />),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByLabelText('Name')).toHaveValue('Ana')
  },
}
export const ProfileDark: Story = {
  render: () => shell(<ProfileSettings me={ME} />),
  globals: { appearance: 'dark' },
}
export const Display: Story = {
  render: () => shell(<DisplaySettings />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText('Can you read the fret numbers from where you play?'),
    ).toBeVisible()
    await expect(canvas.getByRole('switch', { name: 'Hyperlegible font' })).not.toBeChecked()
  },
}
export const DisplayStage: Story = {
  render: () => shell(<DisplaySettings />),
  globals: { appearance: 'stage' },
}
export const Placeholder: Story = {
  render: () =>
    shell(
      <SettingsPlaceholder
        title="Privacy"
        body="Downloading your data and deleting your account arrive here soon."
        icon={<KeyboardIcon aria-hidden />}
      />,
    ),
}

/** Keyboard & pedal (27 §3.9): the binding table, "Learn this pedal" and the test area. */
export const Keyboard: Story = {
  render: () => shell(<KeyboardSettings />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Learn this pedal for Felt clean' }))
    await expect(
      canvas.getByText('Press the pedal or key for Felt clean. Escape cancels.'),
    ).toBeVisible()
    await userEvent.keyboard('{PageDown}')
    await expect(canvas.getByRole('row', { name: /Felt clean/ })).toHaveTextContent('Page down')
    await userEvent.click(canvas.getByRole('button', { name: 'Reset to the defaults' }))
  },
}

export const KeyboardDark: Story = {
  render: () => shell(<KeyboardSettings />),
  globals: { appearance: 'dark' },
}
