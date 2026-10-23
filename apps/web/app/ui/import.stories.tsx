import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
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
  play: async ({ canvasElement }) => {
    const zone = canvasElement.querySelector<HTMLElement>('[data-slot=drop-zone]') as HTMLElement
    await expect(zone).toHaveAttribute('data-dragging')
    await expect(within(zone).getByText(ZONE.dropLabel)).toBeVisible()
    // The zone lifts by 1 % on the spring ease once the transition has run, and rings in primary.
    await waitFor(() => expect(getComputedStyle(zone).scale).toBe('1.01'))
    await expect(getComputedStyle(zone).boxShadow).not.toBe('none')
    await expect(getComputedStyle(zone).transitionTimingFunction).toContain(
      'cubic-bezier(0.34, 1.3',
    )
  },
}

// A click anywhere on the zone that isn't the button opens the picker; the button does it once.
function ZoneClickDemo({ disabled = false }: { disabled?: boolean }) {
  return <DropZone {...ZONE} disabled={disabled} onFiles={fn()} />
}

const spyOnPicker = (canvasElement: HTMLElement) => {
  const input = canvasElement.querySelector<HTMLInputElement>(
    'input[type=file]',
  ) as HTMLInputElement
  const click = fn()
  input.click = click
  return click
}

export const DropZoneClick: Story = {
  render: () => <ZoneClickDemo />,
  play: async ({ canvasElement }) => {
    const click = spyOnPicker(canvasElement)
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'choose a file' })
    // Keyboard: Tab to the button, Enter opens the picker.
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(click).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByText(ZONE.hint))
    await expect(click).toHaveBeenCalledTimes(2)
    await userEvent.click(canvasElement.querySelector('[data-slot=drop-zone]') as HTMLElement)
    await expect(click).toHaveBeenCalledTimes(3)
    // The inner button opens the picker once, not twice (its click also bubbles to the zone).
    await userEvent.click(button)
    await expect(click).toHaveBeenCalledTimes(4)
  },
}

export const DropZoneDisabledClick: Story = {
  render: () => <ZoneClickDemo disabled />,
  play: async ({ canvasElement }) => {
    const click = spyOnPicker(canvasElement)
    await userEvent.click(within(canvasElement).getByText(ZONE.hint))
    await expect(click).not.toHaveBeenCalled()
    await expect(
      within(canvasElement).getByRole('button', { name: 'choose a file' }),
    ).toBeDisabled()
  },
}

export const DropZoneDark: Story = {
  render: () => <DropZone {...ZONE} onFiles={() => undefined} />,
  globals: { appearance: 'dark' },
}
export const DropZoneDraggingStage: Story = {
  render: () => <DropZone {...ZONE} dragging onFiles={() => undefined} />,
  globals: { appearance: 'stage' },
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

export const AnalysisCardChecked: Story = {
  render: () => <AnalysisChoice />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const cards = canvasElement.querySelectorAll<HTMLElement>('[data-slot=radio-card]')
    const [full, lite] = cards
    await expect(cards).toHaveLength(2)
    // Checked = a ring (not colour alone: also the check badge); the other card keeps only elevation 1.
    await expect(getComputedStyle(full as Element).boxShadow).not.toBe(
      getComputedStyle(lite as Element).boxShadow,
    )
    const badge = (full as HTMLElement).querySelector('[data-checked] svg path')
    await expect(badge).not.toBeNull()
    await expect(badge).toHaveAttribute('pathLength', '1')
    await expect(getComputedStyle(badge as Element).animationName).toBe('check-draw')
    await expect((lite as HTMLElement).querySelector('svg')).toBeNull()
    await userEvent.click(canvas.getByRole('radio', { name: /Lite/ }))
    await waitFor(() => {
      expect((lite as HTMLElement).querySelector('svg path')).not.toBeNull()
      expect((full as HTMLElement).querySelector('svg')).toBeNull()
    })
  },
}

export const AnalysisCardsDisabled: Story = { render: () => <AnalysisChoice disabled /> }
export const AnalysisCardsDark: Story = {
  render: () => <AnalysisChoice />,
  globals: { appearance: 'dark' },
}
export const AnalysisCardsStage: Story = {
  render: () => <AnalysisChoice />,
  globals: { appearance: 'stage' },
}
export const AnalysisCardsContrast: Story = {
  render: () => <AnalysisChoice />,
  globals: { contrast: 'more' },
}
