import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { NumberField } from './number-field.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  contrast,
  DAYLIGHT,
  edgeOf,
  expectFocusRing,
  expectTargets,
  isClear,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'

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

// Doc 26 §12.1 `.stepper`: a field-shaped 40 px well (10 px corners) whose only boundary is a 1 px
// --edge (≥ 3:1), the value in tabular figures; each step half is a 44 × 44 box (48 in practice
// density) around its 36 px face (V12).
const well = (root: HTMLElement) =>
  root.querySelector('[data-slot=number-field] > div > div') as HTMLElement

export const Default: Story = {
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const group = well(frame)
      await expect(getComputedStyle(group).borderTopLeftRadius).toBe('10px')
      await expect(edgeOf(group)?.width).toBe(1)
      await expect(contrast(edgeOf(group)?.color ?? '', surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      // The unit sits outside the value and is part of its description.
      await expect(
        within(frame).getByRole('textbox', { name: 'Speed' }),
      ).toHaveAccessibleDescription('%')
    }
  },
}

/** Disabled: the steps and value fade to faint text, the edge stays at ≥ 3:1, nothing fills. */
export const Disabled: Story = {
  args: { disabled: true, inputLabel: 'Speed, unavailable' },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const input = canvas.getByRole('textbox', { name: 'Speed, unavailable' })
      await expect(input).toBeDisabled()
      await expect(
        contrast(edgeOf(well(frame))?.color ?? '', surfaceOf(frame)),
      ).toBeGreaterThanOrEqual(3)
      for (const step of canvas.getAllByRole('button')) {
        await expect(getComputedStyle(step).opacity).toBe('1')
        await expect(isClear(getComputedStyle(step).backgroundColor)).toBe(true)
      }
    }
  },
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
    await expect(well(canvasElement).getBoundingClientRect().height).toBe(40)
    // The value is set in the interface face with tabular figures, so it never shifts as it changes.
    const value = getComputedStyle(canvas.getByRole('textbox'))
    await expect(value.fontFamily).toMatch(/^"?Figtree/)
    await expect(value.fontVariantNumeric).toContain('tabular-nums')
  },
}

export const SteppersPracticeDensity: Story = {
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expectTargets(canvas.getAllByRole('button'), 48)
    await expect(well(canvasElement).getBoundingClientRect().height).toBe(40)
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
    // The outline sits inside the well, so the step halves either side never clip it.
    await expectFocusRing(input)
    await expect(getComputedStyle(input).outlineOffset).toBe('-2px')
    await userEvent.keyboard('{ArrowUp}')
    await expect(input).toHaveValue('75')
  },
}

/** On a coarse pointer the value is 16 px (`text-field`), so iOS doesn't zoom into it. */
export const CoarsePointer: Story = {
  globals: { pointer: 'coarse' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Speed' })
    await expect(getComputedStyle(input).fontSize).toBe('16px')
  },
}

/** At the bounds the step that can't go further is disabled; the value clamps. */
export const AtTheLimit: Story = {
  args: { defaultValue: 200 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Faster' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Slower' })).toBeEnabled()
  },
}
export const FocusDaylight: Story = { ...Focus, globals: DAYLIGHT }

export const AllStatesIncreasedContrast: Story = { globals: BOTH_THEMES_MORE_CONTRAST }
export const Stage: Story = { globals: { appearance: 'stage' } }
