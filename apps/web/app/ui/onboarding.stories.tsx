import type { Meta, StoryObj } from '@storybook/react-vite'
import { DrumIcon, GuitarIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { ChoiceRow, ChoiceRowGroup } from './choice-row.tsx'
import { BassIcon } from './icons/bass.tsx'
import {
  BOTH_THEMES,
  contrast,
  edgeOf,
  expectInkEdge,
  expectTargets,
  shadowsOf,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'

// Onboarding's kit piece (27 §3.3): the instrument and level as ChoiceRows (what replaced the
// tap-to-choose cards: the chosen row has the 1.5 px ink edge and a check, and "coming soon" is a
// disabled row that says why).
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
