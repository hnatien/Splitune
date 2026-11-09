import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  MetronomeIcon,
  PlayIcon,
  RepeatIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SlidersVerticalIcon,
} from 'lucide-react'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { CountInIcon } from './icons/index.tsx'
import { SpeedControl } from './speed-control.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  DAYLIGHT,
  expectTargets,
  StateGrid,
  themeFrames,
} from './story-kit.tsx'
import { TransportButton } from './transport-button.tsx'

// Doc 26 §12.2 TransportButton and SpeedControl, §8 / V11: main practice controls are 64 painted
// and hit in every layout, secondary ones paint 52 (`.ib.lg`); Play is the `.play` disc. On and
// active are `.ib.on` (wash + --primary-line edge), never colour alone.
const meta = { title: 'Kit/TransportButton' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const SPEED_LABELS = { speed: 'Speed', decrease: 'Slower', increase: 'Faster', presets: 'Presets' }

function Speed({ initial = 75 }: { initial?: number }) {
  const [value, setValue] = useState(initial)
  return <SpeedControl value={value} onValueChange={setValue} bpm={96} labels={SPEED_LABELS} />
}

function Metronome({ initial = false }: { initial?: boolean }) {
  const [on, setOn] = useState(initial)
  return (
    <TransportButton
      size="practice-2"
      icon={<MetronomeIcon aria-hidden />}
      label={on ? 'Metronome, on' : 'Metronome'}
      showLabel={false}
      pressed={on}
      onPressedChange={setOn}
    />
  )
}

const Dock = () => (
  <div className="flex flex-wrap items-center gap-2">
    <TransportButton
      icon={<SkipBackIcon aria-hidden />}
      label="Restart loop"
      showLabel={false}
      onClick={fn()}
    />
    <TransportButton
      tone="primary"
      icon={<PlayIcon aria-hidden />}
      label="Play"
      showLabel={false}
      onClick={fn()}
    />
    <TransportButton
      icon={<SkipForwardIcon aria-hidden />}
      label="Next bar"
      showLabel={false}
      onClick={fn()}
    />
    <TransportButton
      icon={<RepeatIcon aria-hidden />}
      label="Loop"
      showLabel={false}
      active
      onClick={fn()}
    />
    <Speed />
    <TransportButton
      size="practice-2"
      icon={<CountInIcon aria-hidden />}
      label="Count-in, 1 bar, on"
      showLabel={false}
      pressed
      onPressedChange={fn()}
    />
    <Metronome />
    <TransportButton
      size="practice-2"
      icon={<SlidersVerticalIcon aria-hidden />}
      label="Mix, unavailable"
      showLabel={false}
      pressed={false}
      disabled
      onPressedChange={fn()}
    />
  </div>
)

export const Default: Story = {
  render: Dock,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const main = ['Restart loop', 'Play', 'Next bar', 'Loop', 'Slower', 'Faster'].map((name) =>
        canvas.getByRole('button', { name }),
      )
      main.push(canvas.getByRole('button', { name: /^Speed: / }))
      await expectTargets(main, 64)
      const secondary = ['Count-in, 1 bar, on', 'Metronome', 'Mix, unavailable'].map((name) =>
        canvas.getByRole('button', { name }),
      )
      await expectTargets(secondary, 52)
    }
  },
}

/** Main controls stay 64 at every distance and density, phones included (V11). */
export const TargetsPracticeDensity: Story = {
  render: Dock,
  globals: { density: 'practice', distance: 'floor', pointer: 'coarse' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expectTargets(
      ['Restart loop', 'Play', 'Next bar', 'Loop', 'Slower', 'Faster'].map((name) =>
        canvas.getByRole('button', { name }),
      ),
      64,
    )
  },
}

export const Hover: Story = {
  render: Dock,
  play: async ({ canvasElement }) => {
    const next = within(canvasElement).getByRole('button', { name: 'Next bar' })
    await userEvent.hover(next)
    await expect(next).toBeVisible()
  },
}
export const HoverDaylight: Story = { ...Hover, globals: DAYLIGHT }

export const Focus: Story = {
  render: Dock,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const restart = within(canvasElement).getByRole('button', { name: 'Restart loop' })
    await expect(restart).toHaveFocus()
    await expect(getComputedStyle(restart).outlineWidth).toBe('2px')
  },
}
export const FocusDaylight: Story = { ...Focus, globals: DAYLIGHT }

/** On: the wash, the --primary-line edge and the state in the accessible name. */
export const On: Story = {
  render: () => <Metronome />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    const [first] = themeFrames(canvasElement)
    const toggle = within(first as HTMLElement).getByRole('button', { name: 'Metronome' })
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveAccessibleName('Metronome, on')
    await expect(getComputedStyle(toggle).boxShadow).toContain('inset')
  },
}

export const Disabled: Story = {
  render: Dock,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const mix = within(frame).getByRole('button', { name: 'Mix, unavailable' })
      await expect(mix).toBeDisabled()
      await expect(getComputedStyle(mix).opacity).toBe('1')
    }
  },
}

export const SpeedStates: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <StateGrid
      states={[
        ['Speed', <Speed key="s" />],
        ['At the slowest', <Speed key="min" initial={50} />],
        ['Full speed', <Speed key="max" initial={100} />],
      ]}
    />
  ),
}

export const SpeedKeyboard: Story = {
  render: () => <Speed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await expect(canvas.getByRole('button', { name: /^Speed: 80/ })).toBeInTheDocument()
    const readout = canvas.getByRole('button', { name: /^Speed: / })
    // The number counts up to the new speed; the accessibility check waits for it to settle.
    await waitFor(() => expect(readout).toHaveTextContent(/^80/))
    await expect(getComputedStyle(readout.firstElementChild as Element).fontFamily).toMatch(
      /^"?JetBrains Mono/,
    )
  },
}

export const AllStates: Story = { render: Dock, globals: BOTH_THEMES }
export const AllStatesIncreasedContrast: Story = {
  render: Dock,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
export const Stage: Story = {
  render: Dock,
  globals: { appearance: 'stage', density: 'practice', distance: 'stand' },
}
