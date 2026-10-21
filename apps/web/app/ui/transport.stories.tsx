import type { Meta, StoryObj } from '@storybook/react-vite'
import { PauseIcon, PlayIcon, RepeatIcon, SkipBackIcon } from 'lucide-react'
import { useState } from 'react'
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test'
import { COPY } from './fixtures.ts'
import { CountInIcon } from './icons/index.tsx'
import { LoopBadge } from './loop-badge.tsx'
import { PassControl } from './pass-control.tsx'
import { SpeedControl } from './speed-control.tsx'
import { TransportButton } from './transport-button.tsx'

const meta = { title: 'Kit/Transport' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function Transport() {
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [countIn, setCountIn] = useState(false)
  const [speed, setSpeed] = useState(70)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <TransportButton
        tone="primary"
        icon={playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
        label={playing ? 'Pause' : 'Play'}
        shortcut="Space"
        onClick={() => setPlaying(!playing)}
      />
      <TransportButton icon={<SkipBackIcon aria-hidden />} label="Restart loop" shortcut="R" />
      <TransportButton
        icon={<RepeatIcon aria-hidden />}
        label="Loop"
        shortcut="L"
        pressed={loop}
        onPressedChange={setLoop}
      />
      <TransportButton
        size="practice-2"
        icon={<CountInIcon aria-hidden />}
        label="Count-in"
        shortcut="C"
        pressed={countIn}
        onPressedChange={setCountIn}
      />
      <SpeedControl
        value={speed}
        onValueChange={setSpeed}
        bpm={120}
        labels={{
          speed: 'Speed',
          decrease: 'Slower',
          increase: 'Faster',
          presets: 'Speed presets',
        }}
        shortcuts={{ decrease: '−', increase: '+' }}
      />
    </div>
  )
}

export const Default: Story = { render: Transport }

/** Acceptance (doc 26 §8): practice targets measure at least 64 × 64, practice-2 at least 48. */
export const Targets: Story = {
  render: Transport,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of ['Play', 'Restart loop', 'Loop', 'Slower', 'Faster']) {
      const box = canvas.getByRole('button', { name }).getBoundingClientRect()
      await expect([name, box.width >= 64, box.height >= 64]).toEqual([name, true, true])
    }
    const countIn = canvas.getByRole('button', { name: 'Count-in' }).getBoundingClientRect()
    await expect(countIn.width).toBeGreaterThanOrEqual(48)
    await expect(countIn.height).toBeGreaterThanOrEqual(48)
  },
}

export const LabelsAtTheStand: Story = {
  render: Transport,
  globals: { distance: 'stand', density: 'practice' },
  play: async ({ canvasElement }) => {
    const play = within(canvasElement).getByRole('button', { name: 'Play' })
    await expect(within(play).getByText('Play')).toBeVisible()
  },
}

export const KeyboardSpeed: Story = {
  render: Transport,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await expect(canvas.getByRole('button', { name: /^Speed: 75/ })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    fireEvent.click(canvas.getByRole('button', { name: 'Slower' }), { shiftKey: true })
    await expect(canvas.getByRole('button', { name: /^Speed: 79/ })).toBeInTheDocument()
  },
}

export const ActiveLoop: Story = {
  render: () => <TransportButton icon={<RepeatIcon aria-hidden />} label="Loop" active />,
}
export const Disabled: Story = {
  render: () => (
    <TransportButton tone="primary" icon={<PlayIcon aria-hidden />} label="Play" disabled />
  ),
}

const LoopBadgesDemo = () => (
  <div className="flex flex-wrap gap-3">
    <LoopBadge state="off">Loop off</LoopBadge>
    <LoopBadge state="armed">Loop · from bar 17…</LoopBadge>
    <LoopBadge state="active">Loop · bars 17–20 · pass 3</LoopBadge>
    <LoopBadge state="resting">Resting · bars 17–20</LoopBadge>
  </div>
)
export const LoopBadges: Story = { render: LoopBadgesDemo }

const PassDemo = () => (
  <PassControl
    labels={{ prompt: COPY.passPrompt, clean: COPY.feltClean, notYet: COPY.notYet }}
    best={COPY.bestTempo}
    shortcuts={{ clean: 'Y', notYet: 'N' }}
    onClean={fn()}
    onNotYet={fn()}
  />
)
export const Pass: Story = { render: PassDemo }
export const PassFirstTime: Story = {
  render: () => (
    <PassControl
      labels={{ prompt: COPY.passPrompt, clean: COPY.feltClean, notYet: COPY.notYet }}
      onClean={fn()}
      onNotYet={fn()}
    />
  ),
}

const Gallery = () => (
  <div className="flex flex-col gap-6">
    <Transport />
    <LoopBadgesDemo />
    <PassDemo />
  </div>
)
export const Dark: Story = { render: Gallery, globals: { appearance: 'dark' } }
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage', distance: 'stand' } }
export const IncreasedContrast: Story = { render: Gallery, globals: { contrast: 'more' } }
export const PracticeDensity: Story = {
  render: Gallery,
  globals: { density: 'practice', distance: 'floor' },
}
