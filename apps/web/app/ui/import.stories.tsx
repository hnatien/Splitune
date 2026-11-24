import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { ChoiceRow, ChoiceRowGroup } from './choice-row.tsx'
import { DropZone } from './drop-zone.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  contrast,
  DAYLIGHT,
  edgeOf,
  expectInkEdge,
  expectTargets,
  resolve,
  StateGrid,
  surfaceOf,
  themeFrames,
} from './story-kit.tsx'
import { WaveformPreview } from './waveform-preview.tsx'

// Import (27 §3.6): the drop zone is the --panel well with a dashed --edge that turns into a solid
// ink edge over the wash while a file is dragged; Full or Lite is a pair of ChoiceRows (the 1.5 px
// ink edge and a check on the chosen one); the picked file's waveform is the opaque peak grey.
const meta = { title: 'Kit/Import' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const ZONE = {
  prompt: 'Drop an audio or video file, or',
  chooseLabel: 'choose a file',
  hint: 'MP3, M4A, WAV, FLAC, OGG, MP4, MOV · up to 20 minutes',
  dropLabel: 'Drop to import',
}

const zoneOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-slot=drop-zone]') as HTMLElement

export const DropZoneDefault: Story = {
  render: () => <DropZone {...ZONE} onFiles={fn()} />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const zone = zoneOf(frame)
      const style = getComputedStyle(zone)
      // At rest: a dashed --edge (≥ 3:1, its only boundary) and the panel radius on the well.
      await expect(style.borderTopStyle).toBe('dashed')
      await expect(contrast(style.borderTopColor, surfaceOf(frame))).toBeGreaterThanOrEqual(3)
      await expect(style.borderTopLeftRadius).toBe(
        resolve(zone, 'borderTopLeftRadius', '--radius-panel'),
      )
      await expect(style.backgroundColor).toBe(resolve(zone, 'backgroundColor', '--panel'))
    }
    const [frame] = themeFrames(canvasElement) as [HTMLElement]
    const button = within(frame).getByRole('button', { name: 'choose a file' })
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await expect(button).toHaveAccessibleDescription(ZONE.hint)
    // The inline link-button has a 44 px tall hit area for fingers.
    await expect(getComputedStyle(button, '::after').height).toBe('44px')
  },
}

export const DropZoneDragging: Story = {
  render: () => <DropZone {...ZONE} dragging onFiles={() => undefined} />,
  play: async ({ canvasElement }) => {
    const zone = canvasElement.querySelector<HTMLElement>('[data-slot=drop-zone]') as HTMLElement
    await expect(zone).toHaveAttribute('data-dragging')
    await expect(within(zone).getByText(ZONE.dropLabel)).toBeVisible()
    // The zone lifts by 1 % on the enter ease once the transition has run, and its dashed edge
    // turns into a solid 1.5 px ink edge (the shape cue) over the wash.
    await waitFor(() => expect(getComputedStyle(zone).scale).toBe('1.01'))
    const style = getComputedStyle(zone)
    await expect(style.borderTopStyle).toBe('solid')
    await expect(style.borderTopColor).toBe(resolve(zone, 'backgroundColor', '--selected'))
    await expect(1 + (edgeOf(zone)?.width ?? 0)).toBe(1.5)
    await expect(style.backgroundColor).toBe(resolve(zone, 'backgroundColor', '--wash'))
    await expect(contrast(style.borderTopColor, style.backgroundColor)).toBeGreaterThanOrEqual(3)
    await expect(style.transitionTimingFunction).toContain('cubic-bezier(0, 0, 0, 1)')
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

export const DropZoneDaylight: Story = {
  render: () => <DropZone {...ZONE} onFiles={() => undefined} />,
  globals: DAYLIGHT,
}

/** `.drop`: rest (1 px dashed --edge on --panel), dragging and disabled, in both themes. */
export const DropZoneStates: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <StateGrid
      className="flex flex-col gap-6"
      states={[
        ['Rest', <DropZone key="r" {...ZONE} onFiles={() => undefined} />],
        ['Dragging', <DropZone key="d" {...ZONE} dragging onFiles={() => undefined} />],
        ['Disabled', <DropZone key="x" {...ZONE} disabled onFiles={() => undefined} />],
      ]}
    />
  ),
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

const WaveformDemo = () => (
  <div className="max-w-xl border-b border-border py-4">
    <WaveformPreview peaks={PEAKS} label="Waveform of Riff in A minor.mp3, 3:42" />
  </div>
)

/** The picked file's peaks in the opaque peak grey (≥ 3:1), named for screen readers. */
export const Waveform: Story = {
  render: WaveformDemo,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const image = within(frame).getByRole('img')
      await expect(image).toHaveAccessibleName('Waveform of Riff in A minor.mp3, 3:42')
      await expect(contrast(getComputedStyle(image).fill, surfaceOf(frame))).toBeGreaterThanOrEqual(
        3,
      )
    }
  },
}

export const WaveformStage: Story = { ...Waveform, globals: { appearance: 'stage' } }
export const WaveformBothThemes: Story = { ...Waveform, globals: BOTH_THEMES }

function AnalysisChoice({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('full')
  return (
    <fieldset className="max-w-xl">
      <legend className="mb-3 text-label">Analysis</legend>
      <ChoiceRowGroup
        aria-label="Analysis"
        value={value}
        onValueChange={(v) => setValue(String(v))}
      >
        <ChoiceRow
          value="full"
          label="Full"
          description="Your part isolated, plus tab. Your first full analysis is free."
          disabled={disabled}
        />
        <ChoiceRow value="lite" label="Lite" description="Beat and chords, fast" />
      </ChoiceRowGroup>
    </fieldset>
  )
}

/** Full or Lite (what replaced the radio cards): two ChoiceRows, operable by arrows. */
export const AnalysisCards: Story = {
  render: () => <AnalysisChoice />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const lite = canvas.getByRole('radio', { name: /Lite/ })
    await expectTargets(canvas.getAllByRole('radio'))
    await userEvent.click(lite)
    await expect(lite).toBeChecked()
    await userEvent.keyboard('{ArrowLeft}')
    await expect(canvas.getByRole('radio', { name: /Full/ })).toBeChecked()
  },
}

/** The chosen row has the 1.5 px ink edge and a check; the row's surface stays the page's. */
export const AnalysisCardChecked: Story = {
  render: () => <AnalysisChoice />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const full = canvas.getByRole('radio', { name: /Full/ })
      const lite = canvas.getByRole('radio', { name: /Lite/ })
      await expect(full).toBeChecked()
      await expectInkEdge(full)
      await expect(full.querySelector('[data-slot=choice-row-indicator] svg')).not.toBeNull()
      await expect(lite.querySelector('[data-slot=choice-row-indicator]')).toBeNull()
      await expect(getComputedStyle(full).backgroundColor).toBe(
        getComputedStyle(lite).backgroundColor,
      )
      await userEvent.click(lite)
      await waitFor(() => expect(edgeOf(lite)?.width).toBe(1.5))
      await expect(edgeOf(full)?.width).toBe(1)
    }
  },
}

export const AnalysisCardsDisabled: Story = {
  render: () => <AnalysisChoice disabled />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const full = within(frame).getByRole('radio', { name: /Full/ })
      await expect(full).toHaveAttribute('aria-disabled', 'true')
      await expect(getComputedStyle(full).opacity).toBe('1')
    }
  },
}
export const AnalysisCardsStage: Story = {
  render: () => <AnalysisChoice />,
  globals: { appearance: 'stage' },
}
export const AnalysisCardsContrast: Story = {
  render: () => <AnalysisChoice />,
  globals: BOTH_THEMES_MORE_CONTRAST,
}
