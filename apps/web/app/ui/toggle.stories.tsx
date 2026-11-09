import type { Meta, StoryObj } from '@storybook/react-vite'
import { LayoutGridIcon, ListIcon, MetronomeIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  DAYLIGHT,
  expectTargets,
  expectUnavailable,
  StateGrid,
  themeFrames,
} from './story-kit.tsx'
import { Toggle } from './toggle.tsx'
import { ToggleGroup, ToggleGroupItem } from './toggle-group.tsx'

// Doc 26 §12.1 `.chip` (Toggle) and `.seg` (ToggleGroup), §12.3: the chip's on-state cue is its
// --primary-line edge, the segment's is the raised capsule.
const meta = { title: 'Base/Toggle', component: Toggle } satisfies Meta<typeof Toggle>
export default meta
type Story = StoryObj<typeof meta>

function Chip(props: { defaultPressed?: boolean; disabled?: boolean; label?: string }) {
  const [pressed, setPressed] = useState(props.defaultPressed ?? false)
  const label = props.label ?? 'Guitar'
  return (
    <Toggle
      pressed={pressed}
      onPressedChange={setPressed}
      disabled={props.disabled ?? false}
      aria-label={props.disabled ? `${label}, unavailable` : undefined}
    >
      {label}
    </Toggle>
  )
}

export const Default: Story = { render: () => <Chip />, globals: BOTH_THEMES }
export const On: Story = {
  render: () => <Chip defaultPressed label="All" />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const chip = within(frame).getByRole('button', { name: 'All' })
      await expect(chip).toHaveAttribute('aria-pressed', 'true')
      // The edge is the cue: an inset ring in --primary-line, not just a wash.
      await expect(getComputedStyle(chip).boxShadow).toContain('inset')
    }
  },
}
export const Disabled: Story = {
  render: () => <Chip disabled label="Vocals" />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement))
      await expectUnavailable(within(frame).getByRole('button'), 'unavailable')
  },
}

export const Hover: Story = {
  render: () => <Chip />,
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByRole('button')
    await userEvent.hover(chip)
    await expect(chip).toBeVisible()
  },
}
export const HoverDaylight: Story = { ...Hover, globals: DAYLIGHT }

export const Focus: Story = {
  render: () => <Chip />,
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByRole('button', { name: 'Guitar' })
    await userEvent.tab()
    await expect(chip).toHaveFocus()
    await expect(getComputedStyle(chip).outlineWidth).toBe('2px')
  },
}
export const FocusDaylight: Story = { ...Focus, globals: DAYLIGHT }

export const Pressed: Story = {
  render: () => <Chip />,
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByRole('button', { name: 'Guitar' })
    await userEvent.tab()
    await userEvent.keyboard(' ')
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
  },
}

/** Chips paint 30 px inside a 44 box (48 in practice density), V12. */
export const Targets: Story = {
  render: () => (
    <div className="flex gap-1.5">
      <Chip defaultPressed label="All" />
      <Chip />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const chips = within(canvasElement).getAllByRole('button')
    await expectTargets(chips, 44)
    for (const chip of chips) await expect(chip.clientHeight).toBe(30)
  },
}
export const TargetsPracticeDensity: Story = {
  ...Targets,
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    const chips = within(canvasElement).getAllByRole('button')
    await expectTargets(chips, 48)
    for (const chip of chips) await expect(chip.clientHeight).toBe(30)
  },
}

function ViewGroup({ disabled = false }: { disabled?: boolean }) {
  const [view, setView] = useState(['tab'])
  return (
    <ToggleGroup
      aria-label="View"
      value={view}
      disabled={disabled}
      onValueChange={(next) => next.length > 0 && setView(next)}
    >
      <ToggleGroupItem value="tab">Tab</ToggleGroupItem>
      <ToggleGroupItem value="notes">Notes</ToggleGroupItem>
      <ToggleGroupItem value="chords">Chords</ToggleGroupItem>
    </ToggleGroup>
  )
}

// The library's grid/list switch: the capsule slides to the pressed item.
function CapsuleGroup() {
  const [view, setView] = useState(['grid'])
  return (
    <ToggleGroup
      aria-label="Layout"
      value={view}
      onValueChange={(next) => next.length > 0 && setView(next)}
    >
      <ToggleGroupItem value="grid" aria-label="Grid">
        <LayoutGridIcon aria-hidden />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List">
        <ListIcon aria-hidden />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

/** The capsule takes the pressed item's box and paints the same 34 px face inside it. */
const capsuleOver = (canvasElement: HTMLElement, item: HTMLElement) => {
  const capsule = canvasElement.querySelector<HTMLElement>('[data-slot="toggle-group-capsule"]')
  return (
    capsule?.style.translate === `${item.offsetLeft}px ${item.offsetTop}px` &&
    capsule.clientHeight === item.clientHeight
  )
}

export const Segmented: Story = {
  render: () => <ViewGroup />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const tab = within(frame).getByRole('button', { name: 'Tab' })
      await waitFor(() => expect(capsuleOver(frame, tab)).toBe(true))
      // Items are the target (44), their faces 34 like `.seg > button`.
      await expectTargets(within(frame).getAllByRole('button'), 44)
      await expect(tab.clientHeight).toBe(34)
    }
  },
}

export const SegmentedPressed: Story = {
  render: () => <ViewGroup />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chords = canvas.getByRole('button', { name: 'Chords' })
    await userEvent.click(chords)
    await expect(chords).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(capsuleOver(canvasElement, chords)).toBe(true))
  },
}

export const SegmentedHover: Story = {
  render: () => <ViewGroup />,
  play: async ({ canvasElement }) => {
    const notes = within(canvasElement).getByRole('button', { name: 'Notes' })
    await userEvent.hover(notes)
    await expect(notes).toBeVisible()
  },
}
export const SegmentedHoverDaylight: Story = { ...SegmentedHover, globals: DAYLIGHT }

export const SegmentedFocus: Story = {
  render: () => <ViewGroup />,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(within(canvasElement).getByRole('button', { name: 'Tab' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(within(canvasElement).getByRole('button', { name: 'Notes' })).toHaveFocus()
  },
}
export const SegmentedFocusDaylight: Story = { ...SegmentedFocus, globals: DAYLIGHT }

export const SegmentedDisabled: Story = {
  render: () => <ViewGroup disabled />,
  globals: BOTH_THEMES,
}

export const SegmentedPracticeDensity: Story = {
  render: () => <ViewGroup />,
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole('button')
    await expectTargets(items, 48)
    for (const item of items) await expect(item.clientHeight).toBe(34)
  },
}

export const Capsule: Story = {
  render: () => <CapsuleGroup />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const grid = canvas.getByRole('button', { name: 'Grid' })
    const list = canvas.getByRole('button', { name: 'List' })
    await waitFor(() => expect(capsuleOver(canvasElement, grid)).toBe(true))
    await expect(canvas.getByRole('group')).toHaveAttribute('data-capsule')
    await userEvent.click(list)
    await expect(list).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(capsuleOver(canvasElement, list)).toBe(true))
    list.focus()
    await userEvent.keyboard('{ArrowLeft}{Enter}')
    await expect(grid).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(capsuleOver(canvasElement, grid)).toBe(true))
  },
}

// A vertical list (the mixer drawer's presets): the capsule moves down the list.
function VerticalGroup() {
  const [mix, setMix] = useState(['part-loud'])
  return (
    <ToggleGroup
      aria-label="Mix"
      orientation="vertical"
      value={mix}
      onValueChange={(next) => next.length > 0 && setMix(next)}
      className="w-64"
    >
      {[
        ['part-loud', 'Your part loud'],
        ['minus-one', 'Minus one'],
        ['original', 'Original'],
      ].map(([value, label]) => (
        <ToggleGroupItem key={value} value={value as string} className="justify-start">
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export const CapsuleVertical: Story = {
  render: () => <VerticalGroup />,
  play: async ({ canvasElement }) => {
    const original = within(canvasElement).getByRole('button', { name: 'Original' })
    await userEvent.click(original)
    await waitFor(() => expect(capsuleOver(canvasElement, original)).toBe(true))
    const capsule = canvasElement.querySelector<HTMLElement>('[data-slot="toggle-group-capsule"]')
    await expect(capsule?.style.width).toBe(`${original.offsetWidth}px`)
  },
}

export const CapsuleNoneChosen: Story = {
  render: () => (
    <ToggleGroup aria-label="Speed" value={[]}>
      <ToggleGroupItem value="50">50 %</ToggleGroupItem>
      <ToggleGroupItem value="75">75 %</ToggleGroupItem>
    </ToggleGroup>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="toggle-group-capsule"]')).toBeNull()
    await expect(within(canvasElement).getByRole('group')).not.toHaveAttribute('data-capsule')
  },
}

const Gallery = () => (
  <StateGrid
    states={[
      ['Chip', <Chip key="c" />],
      ['Chip on', <Chip key="o" defaultPressed label="All" />],
      ['Chip disabled', <Chip key="d" disabled label="Vocals" />],
      [
        'Practice toggle on',
        <Toggle key="p" size="practice-2" defaultPressed aria-label="Metronome, on">
          <MetronomeIcon aria-hidden />
        </Toggle>,
      ],
      ['Segmented', <ViewGroup key="s" />],
      ['Segmented disabled', <ViewGroup key="sd" disabled />],
      ['Icons', <CapsuleGroup key="i" />],
      ['Vertical', <VerticalGroup key="v" />],
    ]}
  />
)

/** Every state in Night Rehearsal and Daylight (the G2 board and visual baseline). */
export const AllStates: Story = { render: Gallery, globals: BOTH_THEMES }
export const AllStatesIncreasedContrast: Story = {
  render: Gallery,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
