import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckIcon, LayoutGridIcon, ListIcon, MetronomeIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.tsx'
import { Toggle } from './toggle.tsx'
import { ToggleGroup, ToggleGroupItem } from './toggle-group.tsx'

const meta = { title: 'Base/Toggle', component: Toggle } satisfies Meta<typeof Toggle>
export default meta
type Story = StoryObj<typeof meta>

function MetronomeToggle(props: { defaultPressed?: boolean; disabled?: boolean }) {
  const [pressed, setPressed] = useState(props.defaultPressed ?? false)
  return (
    <Toggle
      pressed={pressed}
      onPressedChange={setPressed}
      disabled={props.disabled ?? false}
      size="practice-2"
    >
      {pressed ? <CheckIcon aria-hidden /> : <MetronomeIcon aria-hidden />}
      Metronome
    </Toggle>
  )
}

export const Default: Story = { render: () => <MetronomeToggle /> }
export const PressedOn: Story = { render: () => <MetronomeToggle defaultPressed /> }
export const Disabled: Story = { render: () => <MetronomeToggle disabled /> }

export const KeyboardToggle: Story = {
  render: () => <MetronomeToggle />,
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole('button', { name: 'Metronome' })
    await userEvent.tab()
    await expect(toggle).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  },
}

function ViewGroup() {
  const [view, setView] = useState(['tab'])
  return (
    <ToggleGroup
      aria-label="View"
      value={view}
      onValueChange={(next) => next.length > 0 && setView(next)}
    >
      <ToggleGroupItem value="tab">
        {view[0] === 'tab' && <CheckIcon aria-hidden />}
        Tab
      </ToggleGroupItem>
      <ToggleGroupItem value="chords">
        {view[0] === 'chords' && <CheckIcon aria-hidden />}
        Chords
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export const Group: Story = {
  render: () => <ViewGroup />,
  play: async ({ canvasElement }) => {
    const chords = within(canvasElement).getByRole('button', { name: 'Chords' })
    await userEvent.click(chords)
    await expect(chords).toHaveAttribute('aria-pressed', 'true')
  },
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

const capsuleOver = (canvasElement: HTMLElement, item: HTMLElement) => {
  const capsule = canvasElement.querySelector<HTMLElement>('[data-slot="toggle-group-capsule"]')
  return capsule?.style.translate === `${item.offsetLeft}px ${item.offsetTop}px`
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

// A vertical list of rounded-xl items (the mixer drawer's presets): the capsule takes the pressed
// item's corner radius and moves down the list.
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
      {['part-loud', 'minus-one', 'original'].map((value) => (
        <ToggleGroupItem key={value} value={value} className="justify-start rounded-xl">
          {mix[0] === value && <CheckIcon aria-hidden />}
          {value}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export const CapsuleVertical: Story = {
  render: () => <VerticalGroup />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const original = canvas.getByRole('button', { name: 'original' })
    await userEvent.click(original)
    await waitFor(() => expect(capsuleOver(canvasElement, original)).toBe(true))
    const capsule = canvasElement.querySelector<HTMLElement>('[data-slot="toggle-group-capsule"]')
    await expect(capsule?.style.borderRadius).toBe(getComputedStyle(original).borderRadius)
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
  <div className="flex flex-wrap gap-3">
    <MetronomeToggle />
    <MetronomeToggle defaultPressed />
    <MetronomeToggle disabled />
    <ViewGroup />
    <CapsuleGroup />
    <VerticalGroup />
  </div>
)
export const Dark: Story = { render: Gallery, globals: { appearance: 'dark' } }
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage' } }
export const IncreasedContrast: Story = { render: Gallery, globals: { contrast: 'more' } }

const SourceTabs = () => (
  <Tabs defaultValue="file">
    <TabsList aria-label="Add a song">
      <TabsTrigger value="file">File</TabsTrigger>
      <TabsTrigger value="link">Link</TabsTrigger>
      <TabsTrigger value="record">Record</TabsTrigger>
    </TabsList>
    <TabsContent value="file">Choose an audio file from this device.</TabsContent>
    <TabsContent value="link">Paste a link to a song.</TabsContent>
    <TabsContent value="record">Record yourself playing.</TabsContent>
  </Tabs>
)

const Segmented = () => (
  <div className="flex flex-col items-start gap-8">
    <SourceTabs />
    <ViewGroup />
    <CapsuleGroup />
    <VerticalGroup />
  </div>
)

/** One selection idiom: sunken track, raised selected item with a primary edge and bold text. */
export const SegmentedSelection: Story = {
  render: Segmented,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const file = canvas.getByRole('tab', { name: 'File' })
    const link = canvas.getByRole('tab', { name: 'Link' })
    await expect(file).toHaveAttribute('aria-selected', 'true')
    const selected = getComputedStyle(file)
    const unselected = getComputedStyle(link)
    await expect(selected.boxShadow).not.toBe('none')
    await expect(unselected.boxShadow).toBe('none')
    await expect(selected.fontWeight).toBe('600')
    await expect(selected.borderTopColor).not.toBe(unselected.borderTopColor)
    await expect(selected.backgroundColor).not.toBe(
      getComputedStyle(canvas.getByRole('tablist')).backgroundColor,
    )

    const tab = canvas.getByRole('button', { name: 'Tab' })
    const chords = canvas.getByRole('button', { name: 'Chords' })
    await expect(getComputedStyle(tab).boxShadow).not.toBe('none')
    await expect(getComputedStyle(chords).boxShadow).toBe('none')
    await userEvent.click(chords)
    await expect(getComputedStyle(chords).boxShadow).not.toBe('none')
    await expect(getComputedStyle(tab).boxShadow).toBe('none')
  },
}

export const SegmentedKeyboard: Story = {
  render: Segmented,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('tab', { name: 'File' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByRole('tab', { name: 'Link' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('tab', { name: 'Link' })).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByText('Paste a link to a song.')).toBeVisible()
  },
}

export const SegmentedDark: Story = { render: Segmented, globals: { appearance: 'dark' } }
export const SegmentedStage: Story = { render: Segmented, globals: { appearance: 'stage' } }
export const SegmentedIncreasedContrast: Story = {
  render: Segmented,
  globals: { contrast: 'more' },
}
