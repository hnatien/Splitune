import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckIcon, MetronomeIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
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

const Gallery = () => (
  <div className="flex flex-wrap gap-3">
    <MetronomeToggle />
    <MetronomeToggle defaultPressed />
    <MetronomeToggle disabled />
    <ViewGroup />
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
