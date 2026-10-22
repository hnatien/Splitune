import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { type TimelineBar, type TimelineLane, WaveformTimeline } from './waveform-timeline.tsx'

// Doc 26 §12.2 WaveformTimeline: lanes per stem, bar ruler (or seconds before the beat grid),
// loop band with handles, unsure-bar hatching, compact ruler (phone landscape).
const meta = { title: 'Kit/WaveformTimeline' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const BLOCK = 512 / 48_000
const DURATION = 20.5

// A plucked line (part) and a steadier bed (backing), as peaks and RMS per block.
function lane(id: string, label: string, pluck: boolean): TimelineLane {
  const blocks = Math.ceil(DURATION / BLOCK)
  const peaks = new Float32Array(blocks * 2)
  const rms = new Float32Array(blocks)
  for (let b = 0; b < blocks; b++) {
    const t = b * BLOCK
    const level = pluck ? 0.9 * Math.exp(-4 * ((t - 0.5) % 0.6)) : 0.35 + 0.1 * Math.sin(t)
    peaks[2 * b] = -level
    peaks[2 * b + 1] = level
    rms[b] = level * 0.55
  }
  return { id, label, peaks, rms }
}

const LANES = [lane('guitar', 'Your part', true), lane('mix_minus_guitar', 'Backing', false)]
const BARS: TimelineBar[] = Array.from({ length: 8 }, (_, bar) => ({
  bar,
  start: 0.5 + bar * 2.4,
  label: String(bar + 1),
}))
const LABELS = {
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  loopStart: 'Loop start, bar 3',
  loopEnd: 'Loop end, bar 4',
}

function Timeline(props: Partial<React.ComponentProps<typeof WaveformTimeline>>) {
  const [loop, setLoop] = useState(props.loop ?? null)
  return (
    <WaveformTimeline
      lanes={LANES}
      blockSeconds={BLOCK}
      duration={DURATION}
      bars={BARS}
      position={() => 6.1}
      onSeek={fn()}
      labels={LABELS}
      {...props}
      loop={loop}
      onNudgeLoop={(edge, direction) =>
        setLoop((current) => current && { ...current, [edge]: current[edge] + direction * 0.15 })
      }
    />
  )
}

export const Default: Story = { render: () => <Timeline /> }

export const Loop: Story = {
  render: () => <Timeline loop={{ start: 5.3, end: 10.1 }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Handles appear once the timeline has measured its width.
    const start = await canvas.findByRole('button', { name: 'Loop start, bar 3' })
    const box = start.getBoundingClientRect()
    // Handles are at least 44 px wide (26 §12.2) and move by a sixteenth with the arrow keys.
    await expect(box.width).toBeGreaterThanOrEqual(44)
    const before = start.style.left
    start.focus()
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(start.style.left).not.toBe(before))
  },
}

export const UnsureBars: Story = {
  render: () => (
    <Timeline
      unsure={[
        { start: 7.7, end: 10.1 },
        { start: 15, end: 17.3 },
      ]}
    />
  ),
}

/** Before the beat grid exists: a seconds ruler, loops by time. */
export const SecondsRuler: Story = { render: () => <Timeline bars={undefined} /> }

export const SingleLane: Story = {
  render: () => <Timeline lanes={[lane('mix', 'Song', true)]} />,
}

/** Phone landscape: a 32 px ruler with the loop band (27 §3.7.2). */
export const Compact: Story = {
  render: () => <Timeline compact loop={{ start: 5.3, end: 10.1 }} />,
}

export const Dark: Story = {
  render: () => <Timeline loop={{ start: 5.3, end: 10.1 }} />,
  globals: { appearance: 'dark' },
}

export const Stage: Story = {
  render: () => <Timeline loop={{ start: 5.3, end: 10.1 }} />,
  globals: { appearance: 'stage' },
}
