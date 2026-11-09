import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { NumberField } from './number-field.tsx'
import { Slider } from './slider.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  DAYLIGHT,
  expectTargets,
  StateGrid,
} from './story-kit.tsx'

const meta = {
  title: 'Base/Slider',
  component: Slider,
  args: { thumbLabels: ['Speed'] },
} satisfies Meta<typeof Slider>
export default meta
type Story = StoryObj<typeof meta>

function SpeedSlider() {
  const [value, setValue] = useState(70)
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Slider
        value={value}
        min={50}
        max={100}
        onValueChange={(next) => setValue(Array.isArray(next) ? (next[0] ?? value) : next)}
        thumbLabels={['Speed']}
      />
      <NumberField
        value={value}
        min={50}
        max={100}
        step={5}
        onValueChange={(next) => next !== null && setValue(next)}
        unit="%"
        inputLabel="Speed"
        decrementLabel="Slower"
        incrementLabel="Faster"
      />
    </div>
  )
}

export const Horizontal: Story = {
  render: () => <SpeedSlider />,
  play: async ({ canvasElement }) => {
    const thumb = within(canvasElement).getByRole('slider', { name: 'Speed' })
    thumb.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(thumb).toHaveAttribute('aria-valuenow', '71')
    await userEvent.keyboard('{PageUp}')
    await expect(thumb).toHaveAttribute('aria-valuenow', '81')
    await expect(within(canvasElement).getByRole('textbox', { name: 'Speed' })).toHaveValue('81')
  },
}

export const Vertical: Story = {
  render: () => (
    <div className="h-56">
      <Slider
        orientation="vertical"
        defaultValue={-6}
        min={-30}
        max={6}
        thumbLabels={['Guitar volume']}
      />
    </div>
  ),
}

export const Range: Story = {
  render: () => (
    <div className="max-w-md">
      <Slider
        defaultValue={[17, 20]}
        min={1}
        max={64}
        minStepsBetweenValues={1}
        thumbLabels={['Loop start', 'Loop end']}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [start, end] = within(canvasElement).getAllByRole('slider')
    await expect(start).toHaveAccessibleName('Loop start')
    await expect(end).toHaveAccessibleName('Loop end')
  },
}

export const Disabled: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <div className="max-w-md">
      <Slider defaultValue={70} min={50} max={100} disabled thumbLabels={['Speed, unavailable']} />
    </div>
  ),
}

/** The thumb's own box is the target (44 browse, 48 practice); it paints a 20 px knob. */
export const Targets: Story = {
  render: () => (
    <div className="max-w-md">
      <Slider defaultValue={70} min={50} max={100} thumbLabels={['Speed']} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const thumb = canvasElement.querySelector<HTMLElement>('[data-slot=slider-thumb]')
    await expectTargets(thumb ? [thumb] : [], 44)
    await expect(thumb?.clientWidth).toBe(20)
    await expect(getComputedStyle(thumb as HTMLElement, '::after').content).toBe('none')
  },
}
export const TargetsPracticeDensity: Story = {
  ...Targets,
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    const thumb = canvasElement.querySelector<HTMLElement>('[data-slot=slider-thumb]')
    await expectTargets(thumb ? [thumb] : [], 48)
  },
}

export const Focus: Story = {
  render: () => (
    <div className="max-w-md">
      <Slider defaultValue={70} min={50} max={100} thumbLabels={['Speed']} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(within(canvasElement).getByRole('slider', { name: 'Speed' })).toHaveFocus()
  },
}
export const FocusDaylight: Story = { ...Focus, globals: DAYLIGHT }

const Gallery = () => (
  <StateGrid
    className="flex flex-col gap-6"
    states={[
      ['Slider with steppers', <SpeedSlider key="s" />],
      [
        'Range',
        <div key="r" className="w-md">
          <Slider
            defaultValue={[17, 20]}
            min={1}
            max={64}
            thumbLabels={['Loop start', 'Loop end']}
          />
        </div>,
      ],
      [
        'Disabled',
        <div key="d" className="w-md">
          <Slider
            defaultValue={70}
            min={50}
            max={100}
            disabled
            thumbLabels={['Speed, unavailable']}
          />
        </div>,
      ],
      [
        'Vertical',
        <div key="v" className="h-40">
          <Slider
            orientation="vertical"
            defaultValue={-6}
            min={-30}
            max={6}
            thumbLabels={['Bass volume']}
          />
        </div>,
      ],
    ]}
  />
)
export const AllStates: Story = { render: Gallery, globals: BOTH_THEMES }
export const AllStatesIncreasedContrast: Story = {
  render: Gallery,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
export const Stage: Story = {
  render: Gallery,
  globals: { appearance: 'stage', density: 'practice' },
}
