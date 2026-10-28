import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { HowStage } from './how-scenes'

// How it works' scenes (27 §3.2) at their first frame, half way and their last frame: the frames a
// reader sees when they stop scrolling, and the last one is all reduced motion shows.
const meta = { title: 'Screens/Marketing/How it works scenes' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const frames = (step: number) => () => (
  <div className="grid gap-6 lg:grid-cols-3">
    {[0, 0.5, 1].map((t) => (
      <HowStage key={t} step={step} t={t} only />
    ))}
  </div>
)

export const Import: Story = {
  render: frames(0),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Ready to analyse')).toBeInTheDocument()
    await expect(canvas.getAllByText('Reading the audio')).toHaveLength(2)
  },
}
export const Separate: Story = { render: frames(1) }
export const Transcribe: Story = { render: frames(2) }
export const Practise: Story = {
  render: frames(3),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loop · bars 5–8 · pass 3')).toBeInTheDocument()
    await expect(canvas.getByText(/Best clean pass: 70/)).toBeInTheDocument()
  },
}
export const PractiseDark: Story = { render: frames(3), globals: { appearance: 'dark' } }
export const TranscribeStage: Story = { render: frames(2), globals: { appearance: 'stage' } }
