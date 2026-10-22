import type { Meta, StoryObj } from '@storybook/react-vite'
import { DrumIcon, GuitarIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ChoiceCard } from './choice-card.tsx'
import { CoachMark } from './coach-mark.tsx'
import { BassIcon } from './icons/bass.tsx'
import { StepDots } from './step-dots.tsx'

// Onboarding's kit pieces (27 §3.3): tap-to-choose cards (available and "coming soon"), the
// progress dots with their "Step n of 5" text, and a dismissible, non-modal coach mark.
const meta = { title: 'Kit/Onboarding' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const onChoose = fn()

const choices = () => (
  <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
    <ChoiceCard icon={<GuitarIcon />} title="Guitar" onClick={() => onChoose('guitar')} />
    <ChoiceCard icon={<BassIcon />} title="Bass" onClick={() => onChoose('bass')} />
    <ChoiceCard
      icon={<DrumIcon />}
      title="Drums"
      description="Coming soon — try guitar or bass"
      unavailable
      onClick={() => onChoose('drums')}
    />
    <ChoiceCard title="I can play a few songs" onClick={() => onChoose('few_songs')} />
  </div>
)

export const Choices: Story = {
  render: choices,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Guitar' }))
    await expect(onChoose).toHaveBeenLastCalledWith('guitar')
    const drums = canvas.getByRole('button', { name: /^Drums/ })
    // Unavailable stays focusable and says why, but does nothing.
    await expect(drums).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(drums)
    await expect(onChoose).toHaveBeenLastCalledWith('guitar')
  },
}
export const ChoicesDark: Story = { render: choices, globals: { appearance: 'dark' } }

export const Steps: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[1, 3, 5].map((step) => (
        <StepDots
          key={step}
          step={step}
          total={5}
          text={`Step ${step} of 5`}
          label="Onboarding progress"
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Step 3 of 5')).toBeVisible()
    const current = canvasElement.querySelectorAll('[aria-current=step]')
    await expect(current).toHaveLength(3)
  },
}

function CoachDemo() {
  const [open, setOpen] = useState(true)
  return open ? (
    <CoachMark dismissLabel="Got it" onDismiss={() => setOpen(false)}>
      We've looped bars 5–8 at 70 %. Play along.
    </CoachMark>
  ) : (
    <p>Dismissed</p>
  )
}

export const Coach: Story = {
  render: () => <CoachDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent(/looped bars 5–8/)
    await userEvent.click(canvas.getByRole('button', { name: 'Got it' }))
    await expect(canvas.getByText('Dismissed')).toBeVisible()
  },
}
export const CoachStage: Story = {
  render: () => <CoachDemo />,
  globals: { appearance: 'stage' },
}
