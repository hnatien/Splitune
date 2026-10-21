import type { Meta, StoryObj } from '@storybook/react-vite'
import { KeyboardIcon } from 'lucide-react'
import { expect, within } from 'storybook/test'
import { AppStory } from '../../../.storybook/app.tsx'
import { AppShell } from '../shell/app-shell'
import { ME } from '../story-fixtures'
import { DisplaySettings } from './display-settings'
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
        title="Keyboard & pedal"
        body="Keyboard shortcuts and pedal bindings arrive with the practice screen."
        icon={<KeyboardIcon aria-hidden />}
      />,
    ),
}
