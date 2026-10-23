import type { Meta, StoryObj } from '@storybook/react-vite'
import { DrumIcon, GuitarIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
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
export const ChoicesStage: Story = { render: choices, globals: { appearance: 'stage' } }

export const ChoicesRaised: Story = {
  render: choices,
  play: async ({ canvasElement }) => {
    const [available, , unavailable] =
      canvasElement.querySelectorAll<HTMLElement>('[data-slot=choice-card]')
    // Available cards sit on elevation 1; an unavailable one is flat and sunken.
    await expect(getComputedStyle(available as Element).boxShadow).not.toBe(
      getComputedStyle(unavailable as Element).boxShadow,
    )
    await expect(getComputedStyle(available as Element).backgroundColor).not.toBe(
      getComputedStyle(unavailable as Element).backgroundColor,
    )
  },
}

const steps = () => (
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
)

export const Steps: Story = {
  render: steps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Step 3 of 5')).toBeVisible()
    const current = canvasElement.querySelectorAll<HTMLElement>('[aria-current=step]')
    await expect(current).toHaveLength(3)
    // The current dot is a 24 px pill, the others 10 px dots.
    for (const dot of current) await expect(dot.getBoundingClientRect().width).toBe(24)
    const others = canvasElement.querySelectorAll<HTMLElement>('li:not([aria-current])')
    await expect(others).toHaveLength(12)
    for (const dot of others) await expect(dot.getBoundingClientRect().width).toBe(10)
  },
}
export const StepsDark: Story = { render: steps, globals: { appearance: 'dark' } }
export const StepsStage: Story = { render: steps, globals: { appearance: 'stage' } }

function StepAdvance() {
  const [step, setStep] = useState(1)
  return (
    <div className="flex flex-col gap-4">
      <StepDots step={step} total={3} text={`Step ${step} of 3`} label="Progress" />
      <Button onClick={() => setStep(2)}>Next</Button>
    </div>
  )
}

export const StepsAdvance: Story = {
  render: () => <StepAdvance />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    // The widening is a width transition (not a swap), so it settles on the new pill.
    await waitFor(() => {
      const [first, second] = canvasElement.querySelectorAll<HTMLElement>('li')
      expect((first as HTMLElement).getBoundingClientRect().width).toBe(10)
      expect((second as HTMLElement).getBoundingClientRect().width).toBe(24)
    })
    await expect(canvas.getByText('Step 2 of 3')).toBeVisible()
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
    const mark = canvasElement.querySelector<HTMLElement>('[data-slot=coach-mark]') as HTMLElement
    await expect(getComputedStyle(mark).animationName).toBe('pop-in')
    await expect(getComputedStyle(mark).boxShadow).not.toBe('none')
    await userEvent.click(canvas.getByRole('button', { name: 'Got it' }))
    await expect(canvas.getByText('Dismissed')).toBeVisible()
  },
}
export const CoachDark: Story = {
  render: () => <CoachDemo />,
  globals: { appearance: 'dark' },
}
export const CoachStage: Story = {
  render: () => <CoachDemo />,
  globals: { appearance: 'stage' },
}
