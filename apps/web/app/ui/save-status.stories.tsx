import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SaveStatus } from './save-status.tsx'
import { BOTH_THEMES, contrast, isClear, StateGrid, surfaceOf, themeFrames } from './story-kit.tsx'

// Per-field save feedback (27 §3.9): a glyph and words like Status, with no badge or tint behind
// them. Saved is the circled tick in --success drawing itself; an error stays with its reason.

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
    const status = within(canvasElement).getByRole('status')
    await expect(status).toHaveTextContent('Saved')
    // A glyph and words: no badge surface behind them.
    await expect(isClear(getComputedStyle(status).backgroundColor)).toBe(true)
    // The tick draws itself: a one-unit path with a one-unit dash and the check-draw animation.
    const tick = canvasElement.querySelector('svg path[pathLength]') as SVGPathElement
    await expect(tick).toHaveAttribute('pathLength', '1')
    await expect(parseFloat(getComputedStyle(tick).strokeDasharray)).toBe(1)
    await expect(getComputedStyle(tick).animationName).toBe('check-draw')
  },
}
export const ErrorState: Story = { name: 'Error', args: { state: 'error', ...labels } }
/** Saving, saved and error, in both themes; each a glyph and words at text contrast. */
export const AllStates: Story = {
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const statuses = within(frame).getAllByRole('status')
      await expect(statuses).toHaveLength(3)
      for (const status of statuses) {
        await expect(isClear(getComputedStyle(status).backgroundColor)).toBe(true)
        await expect(status.querySelector('svg')).not.toBeNull()
        const words = status.querySelector('span') as HTMLElement
        await expect(
          contrast(getComputedStyle(words).color, surfaceOf(frame)),
        ).toBeGreaterThanOrEqual(4.5)
      }
      // The three states keep one height, so the row never jumps as it saves.
      const heights = statuses.map((status) => status.getBoundingClientRect().height)
      await expect(new Set(heights).size).toBe(1)
    }
  },
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
    const tick = canvasElement.querySelector('svg path[pathLength]') as SVGPathElement
    // Zero duration jumps to the drawn tick.
    await expect(getComputedStyle(tick).animationDuration).toBe('0s')
  },
}
