import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DropZone } from './drop-zone.tsx'
import { RadioCard, RadioCardGroup } from './radio-card.tsx'
import { WaveformPreview } from './waveform-preview.tsx'

const meta = { title: 'Kit/Import' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const ZONE = {
  prompt: 'Drop an audio or video file, or',
  chooseLabel: 'choose a file',
  hint: 'MP3, M4A, WAV, FLAC, OGG, MP4, MOV · up to 20 minutes',
  dropLabel: 'Drop to import',
}

export const DropZoneDefault: Story = {
  render: () => <DropZone {...ZONE} onFiles={fn()} />,
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'choose a file' })
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await expect(button).toHaveAccessibleDescription(ZONE.hint)
  },
}

export const DropZoneDragging: Story = {
  render: () => <DropZone {...ZONE} dragging onFiles={() => undefined} />,
}

export const DropZoneDark: Story = {
  render: () => <DropZone {...ZONE} onFiles={() => undefined} />,
  globals: { appearance: 'dark' },
}

// A plucked-string envelope: sharp attacks, decays and a quieter middle.
const PEAKS = Array.from({ length: 400 }, (_, i) => {
  const beat = (i % 25) / 25
  const section = i > 150 && i < 230 ? 0.45 : 0.9
  return Math.max(0.04, section * Math.exp(-4 * beat) * (0.75 + 0.25 * Math.sin(i / 7)))
})

export const Waveform: Story = {
  render: () => (
    <div className="max-w-xl rounded-xl border border-border bg-card p-4">
      <WaveformPreview peaks={PEAKS} label="Waveform of Riff in A minor.mp3, 3:42" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img')).toHaveAccessibleName(
      'Waveform of Riff in A minor.mp3, 3:42',
    )
  },
}

export const WaveformStage: Story = { ...Waveform, globals: { appearance: 'stage' } }

function AnalysisChoice({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('full')
  return (
    <fieldset className="max-w-xl">
      <legend className="mb-3 text-base font-medium">Analysis</legend>
      <RadioCardGroup value={value} onValueChange={(v) => setValue(String(v))}>
        <RadioCard
          value="full"
          title="Full"
          description="Your part isolated, plus tab"
          meta="Your first full analysis is free — your part isolated, plus tab."
          disabled={disabled}
        />
        <RadioCard value="lite" title="Lite" description="Beat and chords, fast" />
      </RadioCardGroup>
    </fieldset>
  )
}

export const AnalysisCards: Story = {
  render: () => <AnalysisChoice />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const lite = canvas.getByRole('radio', { name: /Lite/ })
    await userEvent.click(lite)
    await expect(lite).toBeChecked()
    await userEvent.keyboard('{ArrowLeft}')
    await expect(canvas.getByRole('radio', { name: /Full/ })).toBeChecked()
  },
}

export const AnalysisCardsDisabled: Story = { render: () => <AnalysisChoice disabled /> }
export const AnalysisCardsDark: Story = {
  render: () => <AnalysisChoice />,
  globals: { appearance: 'dark' },
}
export const AnalysisCardsContrast: Story = {
  render: () => <AnalysisChoice />,
  globals: { contrast: 'more' },
}
