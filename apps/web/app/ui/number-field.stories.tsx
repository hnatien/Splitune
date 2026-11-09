import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { NumberField } from './number-field.tsx'
import { BOTH_THEMES, BOTH_THEMES_MORE_CONTRAST, DAYLIGHT, expectTargets } from './story-kit.tsx'

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

// Doc 26 §12.1 `.stepper`: a 40 px --background well with an --input edge and a mono value; each
// step half is a 44 × 44 box (48 in practice density) around its 36 px face (V12).
export const Default: Story = { globals: BOTH_THEMES }
export const Disabled: Story = {
  args: { disabled: true, inputLabel: 'Speed, unavailable' },
  globals: BOTH_THEMES,
}
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
  globals: BOTH_THEMES,
}

export const Steppers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await expect(canvas.getByRole('textbox', { name: 'Speed' })).toHaveValue('75')
    await expectTargets(canvas.getAllByRole('button'), 44)
    const well = canvasElement.querySelector('[data-slot=number-field] > div > div') as HTMLElement
    await expect(well.getBoundingClientRect().height).toBe(40)
    await expect(getComputedStyle(canvas.getByRole('textbox')).fontFamily).toMatch(
      /^"?JetBrains Mono/,
    )
  },
}

export const SteppersPracticeDensity: Story = {
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expectTargets(canvas.getAllByRole('button'), 48)
    const well = canvasElement.querySelector('[data-slot=number-field] > div > div') as HTMLElement
    await expect(well.getBoundingClientRect().height).toBe(40)
  },
}

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const faster = within(canvasElement).getByRole('button', { name: 'Faster' })
    await userEvent.hover(faster)
    await expect(faster).toBeVisible()
  },
}
export const HoverDaylight: Story = { ...Hover, globals: DAYLIGHT }

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const input = within(canvasElement).getByRole('textbox', { name: 'Speed' })
    await expect(input).toHaveFocus()
    await expect(getComputedStyle(input).outlineStyle).toBe('solid')
  },
}
export const FocusDaylight: Story = { ...Focus, globals: DAYLIGHT }

export const AllStatesIncreasedContrast: Story = { globals: BOTH_THEMES_MORE_CONTRAST }
export const Stage: Story = { globals: { appearance: 'stage' } }
