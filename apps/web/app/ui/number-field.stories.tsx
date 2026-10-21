import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { NumberField } from './number-field.tsx'

const meta = {
  title: 'Base/NumberField',
  component: NumberField,
  args: {
    defaultValue: 70,
    min: 25,
    max: 200,
    step: 5,
    unit: '%',
    inputLabel: 'Speed',
    decrementLabel: 'Slower',
    incrementLabel: 'Faster',
  },
} satisfies Meta<typeof NumberField>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const Decibels: Story = {
  args: {
    defaultValue: -3,
    min: -30,
    max: 6,
    step: 1,
    unit: 'dB',
    inputLabel: 'Guitar volume',
    decrementLabel: 'Quieter',
    incrementLabel: 'Louder',
  },
}

export const Steppers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await expect(canvas.getByRole('textbox', { name: 'Speed' })).toHaveValue('75')
    for (const name of ['Slower', 'Faster']) {
      const box = canvas.getByRole('button', { name }).getBoundingClientRect()
      await expect(box.width).toBeGreaterThanOrEqual(44)
      await expect(box.height).toBeGreaterThanOrEqual(44)
    }
  },
}

export const Dark: Story = { globals: { appearance: 'dark' } }
export const Stage: Story = { globals: { appearance: 'stage' } }
