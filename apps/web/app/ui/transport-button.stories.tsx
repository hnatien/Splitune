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
import { contrastRatio, inkEdgeOf, insetRings, rgbOf, sameColour, tokenColour } from './fixtures.ts'
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

// Doc 26 §8, §12.2 TransportButton and SpeedControl, s47 direction §6: Play is the one filled
// control, a 64 px ink circle; every other control is a quiet 48 px circle (a pill once a label
// or key cap shows). On and active are the 1.5 px ink edge, never a fill; disabled keeps a ≥ 3:1
// edge and says why.
const meta = { title: 'Kit/TransportButton' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const SPEED_LABELS = { speed: 'Speed', decrease: 'Slower', increase: 'Faster', presets: 'Presets' }

function Speed({ initial = 75 }: { initial?: number }) {
  const [value, setValue] = useState(initial)
  return (
    <SpeedControl
      value={value}
      onValueChange={setValue}
      bpm={96}
      inlinePresets={false}
      labels={SPEED_LABELS}
      shortcuts={{ decrease: ',', increase: '.' }}
    />
  )
}

function Metronome({ initial = false }: { initial?: boolean }) {
  const [on, setOn] = useState(initial)
  return (
    <TransportButton
      icon={<MetronomeIcon aria-hidden />}
      label={on ? 'Metronome, on' : 'Metronome'}
      showLabel={false}
      pressed={on}
      onPressedChange={setOn}
    />
  )
}

const Dock = () => (
  <div className="flex flex-wrap items-center gap-1">
    <TransportButton
      icon={<SkipBackIcon aria-hidden />}
      label="Previous bar"
      showLabel={false}
      shortcut="←"
      onClick={fn()}
    />
    <TransportButton
      tone="primary"
      icon={<PlayIcon aria-hidden />}
      label="Play"
      shortcut="Space"
      onClick={fn()}
    />
    <TransportButton
      icon={<SkipForwardIcon aria-hidden />}
      label="Next bar"
      showLabel={false}
      shortcut="→"
      onClick={fn()}
    />
    <TransportButton
      icon={<RepeatIcon aria-hidden />}
      label="Loop"
      showLabel={false}
      shortcut="L"
      active
      onClick={fn()}
    />
    <Speed />
    <TransportButton
      icon={<CountInIcon aria-hidden />}
      label="Count-in, 1 bar, on"
      showLabel={false}
      shortcut="I"
      pressed
      onPressedChange={fn()}
    />
    <Metronome />
    <TransportButton
      icon={<SlidersVerticalIcon aria-hidden />}
      label="Mix"
      showLabel={false}
      pressed={false}
      disabled
      unavailableLabel="Unavailable · after your part is isolated"
      onPressedChange={fn()}
    />
  </div>
)

const OTHERS = ['Previous bar', 'Next bar', 'Loop', 'Slower', 'Faster', 'Count-in, 1 bar, on']

/** Play is 64 × 64; every other control is at least the 48 px practice target. */
export const Default: Story = {
  render: Dock,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const play = canvas.getByRole('button', { name: 'Play' }).getBoundingClientRect()
      await expect([Math.round(play.width), Math.round(play.height)]).toEqual([64, 64])
      const others = OTHERS.map((name) => canvas.getByRole('button', { name }))
      others.push(canvas.getByRole('button', { name: /^Speed: / }))
      others.push(canvas.getByRole('button', { name: 'Metronome' }))
      others.push(canvas.getByRole('button', { name: /^Mix/ }))
      await expectTargets(others, 48)
    }
  },
}

/** A touch pointer drops the key caps, so every icon-only control is a 48 px circle. */
export const CirclesOnTouch: Story = {
  render: Dock,
  globals: { density: 'practice', distance: 'floor', pointer: 'coarse' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of ['Previous bar', 'Next bar', 'Loop', 'Slower', 'Faster']) {
      const box = canvas.getByRole('button', { name }).getBoundingClientRect()
      await expect([name, Math.round(box.width), Math.round(box.height)]).toEqual([name, 48, 48])
    }
    const play = canvas.getByRole('button', { name: 'Play' }).getBoundingClientRect()
    await expect([Math.round(play.width), Math.round(play.height)]).toEqual([64, 64])
  },
}

/** Fine pointers print each key under Play's icon and beside the others'. */
export const KeyCaps: Story = {
  render: Dock,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const [name, key] of [
      ['Play', 'Space'],
      ['Previous bar', '←'],
      ['Loop', 'L'],
      ['Slower', ','],
    ] as const) {
      const control = canvas.getByRole('button', { name })
      await expect(control).toHaveAttribute('aria-keyshortcuts', key)
      await expect(within(control).getByText(key)).toBeVisible()
    }
    // Play's cap reads on the ink: it is drawn in the paper colour.
    const cap = within(canvas.getByRole('button', { name: 'Play' })).getByText('Space')
    await expect(
      sameColour(getComputedStyle(cap).color, tokenColour('--primary-foreground', cap)),
    ).toBe(true)
  },
}

export const Hover: Story = {
  render: Dock,
  play: async ({ canvasElement }) => {
    const next = within(canvasElement).getByRole('button', { name: 'Next bar' })
    await userEvent.hover(next)
    // Testing Library's hover is a synthetic event that never reaches CSS :hover, so the hover
    // fill itself is checked in the screenshots; here hovering must not change the state.
    await expect(next).toBeVisible()
    await expect(next).not.toHaveAttribute('aria-pressed')
    await expect(
      contrastRatio(tokenColour('--foreground', next), tokenColour('--hover', next)),
    ).toBeGreaterThanOrEqual(7)
  },
}
export const HoverDaylight: Story = { ...Hover, globals: DAYLIGHT }

export const Focus: Story = {
  render: Dock,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const previous = within(canvasElement).getByRole('button', { name: 'Previous bar' })
    await expect(previous).toHaveFocus()
    const style = getComputedStyle(previous)
    await expect(style.outlineWidth).toBe('2px')
    await expect(style.outlineStyle).toBe('solid')
  },
}
export const FocusDaylight: Story = { ...Focus, globals: DAYLIGHT }

/** On: the 1.5 px ink edge, ≥ 3:1 on the page, no fill, and the state in the accessible name. */
export const On: Story = {
  render: () => (
    <div className="flex gap-2">
      <Metronome />
      <TransportButton icon={<RepeatIcon aria-hidden />} label="Loop" showLabel={false} active />
    </div>
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const toggle = within(frame).getByRole('button', { name: 'Metronome' })
      await userEvent.click(toggle)
      await userEvent.unhover(toggle)
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')
      await expect(toggle).toHaveAccessibleName('Metronome, on')
      const loop = within(frame).getByRole('button', { name: 'Loop' })
      for (const control of [toggle, loop]) {
        await waitFor(async () => {
          const edge = inkEdgeOf(control)
          await expect(edge.width).toBe(1.5)
          await expect(edge.contrast).toBeGreaterThanOrEqual(3)
          await expect(edge.fill).toBe(0)
        })
      }
    }
  },
}

/** Disabled: faint text, a ≥ 3:1 edge, no fill, never faded, and why in its name. */
export const Disabled: Story = {
  render: Dock,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const mix = within(frame).getByRole('button', {
        name: 'Mix, Unavailable · after your part is isolated',
      })
      await expect(mix).toBeDisabled()
      const style = getComputedStyle(mix)
      await expect(style.opacity).toBe('1')
      await expect(rgbOf(style.backgroundColor)[3]).toBe(0)
      await expect(sameColour(style.color, tokenColour('--faint-foreground', mix))).toBe(true)
      // A dashed edge, never the solid ring that marks "on".
      const edge = tokenColour('--edge', mix)
      await expect(style.outlineStyle).toBe('dashed')
      await expect(sameColour(style.outlineColor, edge)).toBe(true)
      await expect(insetRings(mix).some((ring) => sameColour(ring.colour, edge))).toBe(false)
      await expect(contrastRatio(edge, tokenColour('--background', mix))).toBeGreaterThanOrEqual(3)
    }
  },
}

/** Play waiting for the audio: no fill, the edge and faint icon, the reason in its name. */
export const PlayUnavailable: Story = {
  render: () => (
    <TransportButton
      tone="primary"
      icon={<PlayIcon aria-hidden />}
      label="Play"
      shortcut="Space"
      disabled
      unavailableLabel="Unavailable · loading the audio"
    />
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const play = within(frame).getByRole('button', {
        name: 'Play, Unavailable · loading the audio',
      })
      await expect(rgbOf(getComputedStyle(play).backgroundColor)[3]).toBe(0)
      await expect(getComputedStyle(play).opacity).toBe('1')
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
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      // At either end its stepper is unavailable; the readout keeps its width.
      const [slower] = canvas.getAllByRole('button', { name: 'Slower' }).slice(1)
      await expect(slower).toBeDisabled()
      const widths = canvas
        .getAllByRole('button', { name: /^Speed: / })
        .map((readout) => readout.getBoundingClientRect().width)
      await expect(new Set(widths).size).toBe(1)
    }
  },
}

export const SpeedKeyboard: Story = {
  render: () => <Speed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await expect(canvas.getByRole('button', { name: /^Speed: 80/ })).toBeInTheDocument()
    const readout = canvas.getByRole('button', { name: /^Speed: / })
    const number = readout.querySelector('[aria-hidden] > span') as HTMLElement
    // The number counts up to the new speed; the accessibility check waits for it to settle.
    await waitFor(() => expect(number).toHaveTextContent(/^80/))
    // The readout is set in the reading face with tabular figures.
    const style = getComputedStyle(number)
    await expect(style.fontFamily).toMatch(/^"?Figtree/)
    await expect(style.fontVariantNumeric).toContain('tabular-nums')
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
