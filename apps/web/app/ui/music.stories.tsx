import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { ChordChip } from './chord-chip.tsx'
import { ConfidenceLegend } from './confidence-legend.tsx'
import { COPY, FIXTURE_CHORDS } from './fixtures.ts'

const meta = { title: 'Kit/Chords and confidence' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** The fixture's Am–F–C–G strip: G is low confidence, so it gets the dashed box and "?". */
function ChordStrip({ current = 1, editable = false }: { current?: number; editable?: boolean }) {
  const [show, setShow] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {FIXTURE_CHORDS.map((chord, index) => (
          <ChordChip
            key={chord.id}
            label={chord.label}
            confidence={chord.confidence}
            timing={index < current ? 'past' : index === current ? 'current' : 'upcoming'}
            showUncertainty={show}
            confidenceText={
              chord.confidence === 'low' ? COPY.unsure.toLowerCase() : COPY.probably.toLowerCase()
            }
            selected={selected === chord.id}
            onClick={
              editable ? () => setSelected(selected === chord.id ? null : chord.id) : undefined
            }
          />
        ))}
      </div>
      <ConfidenceLegend
        text={COPY.legend}
        labels={{ showUncertainty: COPY.showUncertainty, medium: COPY.probably, low: COPY.unsure }}
        showUncertainty={show}
        onShowUncertaintyChange={setShow}
      />
    </div>
  )
}

export const Strip: Story = { render: () => <ChordStrip /> }

export const Levels: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <ChordChip label="Am" confidence="high" />
      <ChordChip label="F" confidence="medium" confidenceText="probably" />
      <ChordChip label="G7" confidence="low" confidenceText="unsure" />
      <ChordChip label="C" confidence="high" timing="current" />
      <ChordChip label="Em" confidence="low" timing="current" confidenceText="unsure" />
      <ChordChip label="Dm" confidence="medium" selected confidenceText="probably" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'G7, unsure' })).toHaveAttribute(
      'data-confidence',
      'low',
    )
    await expect(canvas.getByRole('button', { name: 'C' })).toHaveAttribute('aria-current', 'true')
  },
}

export const UncertaintyHidden: Story = {
  render: () => <ChordStrip />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: COPY.showUncertainty }))
    // Outlines and "?" go; the lighter ink stays (doc 26 §5).
    const low = canvas.getByRole('button', { name: 'G' })
    await expect(getComputedStyle(low).borderStyle).toBe('solid')
  },
}

export const SelectForEdit: Story = {
  render: () => <ChordStrip editable />,
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByRole('button', { name: /^F/ })
    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
  },
}

export const Hyperlegible: Story = {
  render: () => <ChordStrip />,
  globals: { readingFont: 'hyperlegible' },
}
export const AtTheStand: Story = { render: () => <ChordStrip />, globals: { distance: 'stand' } }
export const Glance: Story = { render: () => <ChordStrip />, globals: { distance: 'floor' } }
export const Dark: Story = { render: () => <ChordStrip />, globals: { appearance: 'dark' } }
export const Stage: Story = { render: () => <ChordStrip />, globals: { appearance: 'stage' } }
export const IncreasedContrast: Story = {
  render: () => <ChordStrip />,
  globals: { contrast: 'more' },
}
