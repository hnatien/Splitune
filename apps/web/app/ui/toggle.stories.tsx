import type { Meta, StoryObj } from '@storybook/react-vite'
import { LayoutGridIcon, ListIcon, MetronomeIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  contrast,
  DAYLIGHT,
  edgeOf,
  expectFocusRing,
  expectInkEdge,
  expectTargets,
  expectUnavailable,
  isClear,
  StateGrid,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'
import { Toggle } from './toggle.tsx'
import { ToggleGroup, ToggleGroupItem } from './toggle-group.tsx'

// Doc 26 §12.1 `.chip` (Toggle) and ToggleGroup, s47 direction §3–§4: "on" is the 1.5 px ink edge
// with ink text and aria-pressed, never a grey fill; `dot` adds a hollow dot that fills when on;
// `invert` fills the ink for the one- and two-letter toggles (M, S). A group is pills side by side
// with no track behind them and nothing that slides.
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
      // The edge is the cue: the 1.5 px ink edge at ≥ 3:1, with no fill behind the label.
      await expectInkEdge(chip)
      await expect(isClear(getComputedStyle(chip).backgroundColor)).toBe(true)
      await expect(contrast(getComputedStyle(chip).color, surfaceOf(frame))).toBeGreaterThanOrEqual(
        7,
      )
    }
  },
}
export const Disabled: Story = {
  render: () => <Chip disabled label="Vocals" />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const chip = within(frame).getByRole('button')
      await expectUnavailable(chip, 'unavailable')
      // Faint text and a ≥ 3:1 --edge ring, never an opacity fade.
      await expect(contrast(edgeOf(chip)?.color ?? '', surfaceOf(frame))).toBeGreaterThanOrEqual(3)
    }
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
    await expectFocusRing(chip)
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

/** Chips paint a 40 px face inside a 44 box (48 in practice density), V12. */
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
    for (const chip of chips) await expect(chip.clientHeight).toBe(40)
  },
}
export const TargetsPracticeDensity: Story = {
  ...Targets,
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    const chips = within(canvasElement).getAllByRole('button')
    await expectTargets(chips, 48)
    for (const chip of chips) await expect(chip.clientHeight).toBe(40)
  },
}

/** A setting's toggle carries a dot too: hollow when off, filled with the ink when on. */
export const WithDot: Story = {
  render: () => (
    <div className="flex gap-1.5">
      <Toggle dot defaultPressed>
        Count-in
      </Toggle>
      <Toggle dot>Metronome</Toggle>
    </div>
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const dot = (name: string) =>
        within(frame)
          .getByRole('button', { name })
          .querySelector('[data-slot=toggle-dot]') as HTMLElement
      await expect(isClear(getComputedStyle(dot('Count-in')).backgroundColor)).toBe(false)
      await expect(isClear(getComputedStyle(dot('Metronome')).backgroundColor)).toBe(true)
      await expect(edgeOf(dot('Metronome'))?.width).toBe(1.5)
    }
  },
}

/** M and S: the inverted pill (the ink, its letter in the page colour at ≥ 4.5:1). */
export const Inverted: Story = {
  render: () => (
    <div className="flex gap-1.5">
      <Toggle variant="invert" defaultPressed aria-label="Mute guitar">
        M
      </Toggle>
      <Toggle variant="invert" aria-label="Solo guitar">
        S
      </Toggle>
    </div>
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const mute = within(frame).getByRole('button', { name: 'Mute guitar' })
      const solo = within(frame).getByRole('button', { name: 'Solo guitar' })
      const fill = getComputedStyle(mute).backgroundColor
      await expect(contrast(fill, surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      await expect(contrast(getComputedStyle(mute).color, fill)).toBeGreaterThanOrEqual(4.5)
      await expect(isClear(getComputedStyle(solo).backgroundColor)).toBe(true)
    }
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

// The library's grid/list switch.
function IconGroup() {
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

/** The chosen item has the ink edge; the others have none; nothing sits behind the group. */
const expectChosen = async (group: HTMLElement, chosen: HTMLElement) => {
  await expect(isClear(getComputedStyle(group).backgroundColor)).toBe(true)
  for (const item of within(group).getAllByRole('button')) {
    if (item === chosen) await expectInkEdge(item)
    else await expect(edgeOf(item)).toBeUndefined()
    await expect(isClear(getComputedStyle(item).backgroundColor)).toBe(true)
  }
}

export const Group: Story = {
  render: () => <ViewGroup />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const group = within(frame).getByRole('group')
      const tab = within(frame).getByRole('button', { name: 'Tab' })
      await expect(tab).toHaveAttribute('aria-pressed', 'true')
      await expectChosen(group, tab)
      // Items are the target (44), their faces 40.
      await expectTargets(within(frame).getAllByRole('button'), 44)
      await expect(tab.clientHeight).toBe(40)
    }
  },
}

export const GroupPressed: Story = {
  render: () => <ViewGroup />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chords = canvas.getByRole('button', { name: 'Chords' })
    await userEvent.click(chords)
    await expect(chords).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(edgeOf(chords)?.width).toBe(1.5))
    // The edge leaving Tab fades out over the same transition.
    await waitFor(() => expectChosen(canvas.getByRole('group'), chords))
  },
}

export const GroupHover: Story = {
  render: () => <ViewGroup />,
  play: async ({ canvasElement }) => {
    const notes = within(canvasElement).getByRole('button', { name: 'Notes' })
    await userEvent.hover(notes)
    await expect(notes).toBeVisible()
  },
}
export const GroupHoverDaylight: Story = { ...GroupHover, globals: DAYLIGHT }

export const GroupFocus: Story = {
  render: () => <ViewGroup />,
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    const tab = within(canvasElement).getByRole('button', { name: 'Tab' })
    await expect(tab).toHaveFocus()
    await expectFocusRing(tab)
    await userEvent.keyboard('{ArrowRight}')
    await expect(within(canvasElement).getByRole('button', { name: 'Notes' })).toHaveFocus()
  },
}
export const GroupFocusDaylight: Story = { ...GroupFocus, globals: DAYLIGHT }

export const GroupDisabled: Story = {
  render: () => <ViewGroup disabled />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      for (const item of within(frame).getAllByRole('button')) {
        await expect(item).toBeDisabled()
        await expect(getComputedStyle(item).opacity).toBe('1')
      }
    }
  },
}

export const GroupPracticeDensity: Story = {
  render: () => <ViewGroup />,
  globals: { density: 'practice' },
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole('button')
    await expectTargets(items, 48)
    for (const item of items) await expect(item.clientHeight).toBe(40)
  },
}

export const Icons: Story = {
  render: () => <IconGroup />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const grid = canvas.getByRole('button', { name: 'Grid' })
    const list = canvas.getByRole('button', { name: 'List' })
    await expectChosen(canvas.getByRole('group'), grid)
    await userEvent.click(list)
    await expect(list).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(edgeOf(list)?.width).toBe(1.5))
    list.focus()
    await userEvent.keyboard('{ArrowLeft}{Enter}')
    await expect(grid).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(edgeOf(grid)?.width).toBe(1.5))
    await expectTargets(canvas.getAllByRole('button'))
  },
}

// A vertical list (the panel's mix presets): items stretch to the list's width.
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

export const Vertical: Story = {
  render: () => <VerticalGroup />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const group = within(frame).getByRole('group')
      const original = within(frame).getByRole('button', { name: 'Original' })
      await userEvent.click(original)
      await waitFor(() => expect(edgeOf(original)?.width).toBe(1.5))
      await expectChosen(group, original)
      await expect(original.getBoundingClientRect().width).toBe(group.getBoundingClientRect().width)
    }
  },
}

export const NoneChosen: Story = {
  render: () => (
    <ToggleGroup aria-label="Speed" value={[]}>
      <ToggleGroupItem value="50">50 %</ToggleGroupItem>
      <ToggleGroupItem value="75">75 %</ToggleGroupItem>
    </ToggleGroup>
  ),
  play: async ({ canvasElement }) => {
    for (const item of within(canvasElement).getAllByRole('button')) {
      await expect(item).toHaveAttribute('aria-pressed', 'false')
      await expect(edgeOf(item)).toBeUndefined()
    }
  },
}

const Gallery = () => (
  <StateGrid
    states={[
      ['Chip', <Chip key="c" />],
      ['Chip on', <Chip key="o" defaultPressed label="All" />],
      ['Chip disabled', <Chip key="d" disabled label="Vocals" />],
      [
        'Dot on',
        <Toggle key="dot" dot defaultPressed>
          Count-in
        </Toggle>,
      ],
      [
        'Inverted on',
        <Toggle key="m" variant="invert" defaultPressed aria-label="Mute guitar">
          M
        </Toggle>,
      ],
      [
        'Practice toggle on',
        <Toggle key="p" size="practice" defaultPressed aria-label="Metronome, on">
          <MetronomeIcon aria-hidden />
        </Toggle>,
      ],
      ['Group', <ViewGroup key="s" />],
      ['Group disabled', <ViewGroup key="sd" disabled />],
      ['Icons', <IconGroup key="i" />],
      ['Vertical', <VerticalGroup key="v" />],
    ]}
  />
)

/** Every state in Dark and Light (the G2 board and visual baseline). */
export const AllStates: Story = { render: Gallery, globals: BOTH_THEMES }
export const AllStatesIncreasedContrast: Story = {
  render: Gallery,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
