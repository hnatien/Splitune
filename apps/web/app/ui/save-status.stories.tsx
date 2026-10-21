import type { Meta, StoryObj } from '@storybook/react-vite'
import { SaveStatus } from './save-status.tsx'

const meta = { title: 'Kit/SaveStatus', component: SaveStatus } satisfies Meta<typeof SaveStatus>
export default meta
type Story = StoryObj<typeof meta>

const labels = {
  savingLabel: 'Saving…',
  savedLabel: 'Saved',
  errorLabel: "Couldn't save. Try again.",
}

export const Saving: Story = { args: { state: 'saving', ...labels } }
export const Saved: Story = { args: { state: 'saved', ...labels } }
export const ErrorState: Story = { name: 'Error', args: { state: 'error', ...labels } }
export const SavedDark: Story = {
  args: { state: 'saved', ...labels },
  globals: { appearance: 'dark' },
}
export const SavedStage: Story = {
  args: { state: 'saved', ...labels },
  globals: { appearance: 'stage' },
}
