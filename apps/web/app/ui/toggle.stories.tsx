import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckIcon, MetronomeIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
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
