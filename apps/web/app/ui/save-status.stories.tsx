import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SaveStatus } from './save-status.tsx'
import { BOTH_THEMES, StateGrid } from './story-kit.tsx'

const meta = { title: 'Kit/SaveStatus', component: SaveStatus } satisfies Meta<typeof SaveStatus>
export default meta
type Story = StoryObj<typeof meta>

const labels = {
  savingLabel: 'Saving…',
  savedLabel: 'Saved on this device',
  errorLabel: "Couldn't save. Try again.",
}

export const Saving: Story = { args: { state: 'saving', ...labels } }
export const Saved: Story = {
  args: { state: 'saved', ...labels },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Saved')
    // The tick draws itself: a one-unit path with a one-unit dash and the check-draw animation.
    const tick = canvasElement.querySelector('svg path') as SVGPathElement
    await expect(tick).toHaveAttribute('pathLength', '1')
    await expect(parseFloat(getComputedStyle(tick).strokeDasharray)).toBe(1)
    await expect(getComputedStyle(tick).animationName).toBe('check-draw')
  },
}
export const ErrorState: Story = { name: 'Error', args: { state: 'error', ...labels } }
/** Saving, saved (the success badge, 26 §12.2) and error, in both themes. */
export const AllStates: Story = {
  args: { state: 'saved', ...labels },
  globals: BOTH_THEMES,
  render: (args) => (
    <StateGrid
      states={[
        ['Saving', <SaveStatus key="s" {...args} state="saving" />],
        ['Saved', <SaveStatus key="d" {...args} state="saved" />],
        ['Error', <SaveStatus key="e" {...args} state="error" />],
      ]}
    />
  ),
}
export const SavedStage: Story = {
  args: { state: 'saved', ...labels },
  globals: { appearance: 'stage' },
}
export const SavedReducedMotion: Story = {
  args: { state: 'saved', ...labels },
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const tick = canvasElement.querySelector('svg path') as SVGPathElement
    // Zero duration jumps to the drawn tick.
    await expect(getComputedStyle(tick).animationDuration).toBe('0s')
  },
}
