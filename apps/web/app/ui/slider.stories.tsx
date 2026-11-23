import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { NumberField } from './number-field.tsx'
import { Slider } from './slider.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  contrast,
  DAYLIGHT,
  edgeOf,
  expectFocusRing,
  expectTargets,
  StateGrid,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'

// Doc 26 §12.1 `.range`: a 6 px pill track whose only boundary is a 1 px --edge (≥ 3:1), filled
// with the ink up to the value; the thumb's own box is the target and paints a 20 px ink knob.
// Always paired with steppers or a field (WCAG 2.5.7).

const parts = (root: Element) => ({
  track: root.querySelector('[data-slot=slider-track]') as HTMLElement,
  range: root.querySelector('[data-slot=slider-range]') as HTMLElement,
  thumb: root.querySelector('[data-slot=slider-thumb]') as HTMLElement,
})

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
    const { track, range, thumb: knob } = parts(canvasElement)
    await expect(track.getBoundingClientRect().height).toBe(6)
    await expect(edgeOf(track)?.width).toBe(1)
    await expect(
      contrast(edgeOf(track)?.color ?? '', surfaceOf(canvasElement)),
    ).toBeGreaterThanOrEqual(3)
    // The fill and the knob are the ink, ≥ 3:1 on the page.
    for (const ink of [range, knob]) {
      await expect(
        contrast(getComputedStyle(ink).backgroundColor, surfaceOf(canvasElement)),
      ).toBeGreaterThanOrEqual(3)
    }
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

/** Disabled: the fill and knob turn grey, the track keeps its ≥ 3:1 edge, nothing fades. */
export const Disabled: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <div className="max-w-md">
      <Slider defaultValue={70} min={50} max={100} disabled thumbLabels={['Speed, unavailable']} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const { track, thumb } = parts(frame)
      const slider = within(frame).getByRole('slider', { name: 'Speed, unavailable' })
      await expect(slider).toBeDisabled()
      await expect(getComputedStyle(thumb).opacity).toBe('1')
      await expect(contrast(edgeOf(track)?.color ?? '', surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      await expect(
        contrast(getComputedStyle(thumb).backgroundColor, surfaceOf(frame)),
      ).toBeGreaterThanOrEqual(3)
    }
  },
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
    const slider = within(canvasElement).getByRole('slider', { name: 'Speed' })
    await expect(slider).toHaveFocus()
    // The ring sits on the thumb's box (the input inside it is visually hidden).
    await expectFocusRing(parts(canvasElement).thumb)
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
