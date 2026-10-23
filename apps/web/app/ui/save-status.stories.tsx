import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
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
export const SavedDark: Story = {
  args: { state: 'saved', ...labels },
  globals: { appearance: 'dark' },
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
