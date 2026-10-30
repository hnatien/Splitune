import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { HowStage } from './how-scenes'

// How it works' pictures (27 §3.2), one per step.
const meta = { title: 'Screens/Marketing/How it works scenes' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const scene = (step: number) => () => (
  <div className="max-w-2xl">
    <HowStage step={step} />
  </div>
)

export const Import: Story = {
  render: scene(0),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Ready to analyse')).toBeInTheDocument()
  },
}
export const Separate: Story = { render: scene(1) }
export const Transcribe: Story = { render: scene(2) }
export const Practise: Story = {
  render: scene(3),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loop · bars 5–8 · pass 3')).toBeInTheDocument()
    await expect(canvas.getByText(/Best clean pass: 70/)).toBeInTheDocument()
  },
}
export const PractiseDark: Story = { render: scene(3), globals: { appearance: 'dark' } }
export const TranscribeStage: Story = { render: scene(2), globals: { appearance: 'stage' } }
