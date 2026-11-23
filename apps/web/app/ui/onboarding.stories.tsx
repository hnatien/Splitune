import type { Meta, StoryObj } from '@storybook/react-vite'
import { DrumIcon, GuitarIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import { ChoiceRow, ChoiceRowGroup } from './choice-row.tsx'
import { CoachMark } from './coach-mark.tsx'
import { BassIcon } from './icons/bass.tsx'
import { DistanceIllustration } from './icons/distance.tsx'
import { StepDots } from './step-dots.tsx'
import {
  BOTH_THEMES,
  contrast,
  edgeOf,
  expectFloatingLayer,
  expectInkEdge,
  expectTargets,
  shadowsOf,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'

// Onboarding's kit pieces (27 §3.3): the instrument and level as ChoiceRows (what replaced the
// tap-to-choose cards: the chosen row has the 1.5 px ink edge and a check, "coming soon" is a
// disabled row that says why), the progress dots with their "Step n of 5" text, a dismissible,
// non-modal coach mark, and the distance drawings of "Where's your screen?".
const meta = { title: 'Kit/Onboarding' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const onChoose = fn()

function Instruments() {
  const [value, setValue] = useState<string | null>(null)
  return (
    <ChoiceRowGroup
      aria-label="Your instrument"
      value={value}
      onValueChange={(next) => {
        setValue(String(next))
        onChoose(next)
      }}
      className="max-w-md"
    >
      <ChoiceRow value="guitar" icon={<GuitarIcon />} label="Guitar" />
      <ChoiceRow value="bass" icon={<BassIcon />} label="Bass" />
      <ChoiceRow
        value="drums"
        icon={<DrumIcon />}
        label="Drums"
        description="Coming soon. Try guitar or bass for now."
        disabled
      />
      <ChoiceRow
        value="few_songs"
        label="I can play a few songs"
        description="We'll start you on the simplified tab and step up from there."
      />
    </ChoiceRowGroup>
  )
}

export const Choices: Story = {
  render: () => <Instruments />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const guitar = canvas.getByRole('radio', { name: /Guitar/ })
    await expectTargets(canvas.getAllByRole('radio'))
    await userEvent.click(guitar)
    await expect(onChoose).toHaveBeenLastCalledWith('guitar')
    await expect(guitar).toBeChecked()
    // Coming soon stays in the list and says why, but can't be chosen.
    const drums = canvas.getByRole('radio', { name: /Drums/ })
    await expect(drums).toHaveAttribute('aria-disabled', 'true')
    await expect(drums).toHaveTextContent('Coming soon')
    await userEvent.click(drums)
    await expect(onChoose).toHaveBeenLastCalledWith('guitar')
    await expect(drums).not.toBeChecked()
  },
}

/** Chosen is the ink edge plus a check, on the same surface as the rest; nothing is lifted. */
export const ChoicesChosen: Story = {
  render: () => <Instruments />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const bass = canvas.getByRole('radio', { name: /Bass/ })
      const guitar = canvas.getByRole('radio', { name: /Guitar/ })
      await userEvent.click(bass)
      await waitFor(() => expect(edgeOf(bass)?.width).toBe(1.5))
      await expectInkEdge(bass)
      await expect(edgeOf(guitar)?.width).toBe(1)
      await expect(getComputedStyle(bass).backgroundColor).toBe(
        getComputedStyle(guitar).backgroundColor,
      )
      await expect(shadowsOf(bass).filter((shadow) => !shadow.inset)).toEqual([])
      // A disabled row keeps full opacity; its words fade to the faint grey, still ≥ 4.5:1.
      const drums = canvas.getByRole('radio', { name: /Drums/ })
      await expect(getComputedStyle(drums).opacity).toBe('1')
      await expect(
        contrast(getComputedStyle(drums).color, surfaceOf(frame)),
      ).toBeGreaterThanOrEqual(4.5)
    }
  },
}
export const ChoicesStage: Story = {
  render: () => <Instruments />,
  globals: { appearance: 'stage' },
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
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      await expect(canvas.getByText('Step 3 of 5')).toBeVisible()
      const current = frame.querySelectorAll<HTMLElement>('[aria-current=step]')
      await expect(current).toHaveLength(3)
      // The current dot is a 22 × 8 pill, the others 8 px dots (26 §12.2).
      for (const dot of current) await expect(dot.getBoundingClientRect().width).toBe(22)
      const others = frame.querySelectorAll<HTMLElement>('li:not([aria-current])')
      await expect(others).toHaveLength(12)
      for (const dot of others) await expect(dot.getBoundingClientRect().width).toBe(8)
      // Done and current are the ink, upcoming the --edge grey; both ≥ 3:1 on the page.
      const [, , upcoming] = frame.querySelectorAll<HTMLElement>('ol')[0]?.children ?? []
      for (const dot of [current[0], upcoming] as HTMLElement[]) {
        await expect(
          contrast(getComputedStyle(dot).backgroundColor, surfaceOf(frame)),
        ).toBeGreaterThanOrEqual(3)
      }
    }
  },
}

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
    // Only the colour animates; the pill moves to the new step straight away.
    await waitFor(() => {
      const [first, second] = canvasElement.querySelectorAll<HTMLElement>('li')
      expect((first as HTMLElement).getBoundingClientRect().width).toBe(8)
      expect((second as HTMLElement).getBoundingClientRect().width).toBe(22)
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
    // A floating layer: raised, one hairline, 14 px corners, the popover shadow.
    await waitFor(() => expect(getComputedStyle(mark).opacity).toBe('1'))
    await expectFloatingLayer(mark, '--elevation-popover', '--radius-panel')
    await expectTargets([canvas.getByRole('button', { name: 'Got it' })])
    await userEvent.click(canvas.getByRole('button', { name: 'Got it' }))
    await expect(canvas.getByText('Dismissed')).toBeVisible()
  },
}
export const CoachBothThemes: Story = {
  render: () => <CoachDemo />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const mark = frame.querySelector<HTMLElement>('[data-slot=coach-mark]') as HTMLElement
      await waitFor(() => expect(getComputedStyle(mark).opacity).toBe('1'))
      await expectFloatingLayer(mark, '--elevation-popover', '--radius-panel')
    }
  },
}

// The line drawings of onboarding's "Where's your screen?" cards (26 §11).
const drawings = () => (
  <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
    {(['desk', 'stand', 'floor'] as const).map((distance) => (
      <DistanceIllustration key={distance} distance={distance} />
    ))}
  </div>
)

export const Distances: Story = {
  render: drawings,
  play: async ({ canvasElement }) => {
    const svgs = canvasElement.querySelectorAll('[data-slot=distance-illustration]')
    await expect(svgs).toHaveLength(3)
    for (const svg of svgs) await expect(svg).toHaveAttribute('aria-hidden', 'true')
  },
}
export const DistancesBothThemes: Story = { render: drawings, globals: BOTH_THEMES }
