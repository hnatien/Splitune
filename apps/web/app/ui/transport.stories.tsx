import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  MetronomeIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SkipBackIcon,
  SlidersVerticalIcon,
} from 'lucide-react'
import { useState } from 'react'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'
import { cn } from '@/lib/utils'
import { COPY } from './fixtures.ts'
import { CountInIcon } from './icons/index.tsx'
import { LoopBadge } from './loop-badge.tsx'
import { PassControl } from './pass-control.tsx'
import { PedalHud } from './pedal-hud.tsx'
import { SpeedControl } from './speed-control.tsx'
import { TransportButton } from './transport-button.tsx'

const meta = { title: 'Kit/Transport' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const TABLET = { viewport: { value: 'tablet', isRotated: false } }
// Inline presets show from 2xl (1536 px), wider than any of the addon's own viewports.
const WIDE = { viewport: { value: 'wide', isRotated: false } }
const WIDE_VIEWPORTS = {
  viewport: {
    options: {
      wide: {
        name: 'Wide',
        styles: { width: '1600px', height: '900px' },
        type: 'desktop' as const,
      },
    },
  },
}

// The transport bar as the practice screen sets it: restart and a round play (icons only, 26 §11),
// the loop toggle joined to its badge, the speed capsule, the helpers, and the pass pair at the
// right edge; Mix and the pass pair keep their place before stems and a loop exist.
const FADE = 'col-start-1 row-start-1 size-9 transition-[opacity,scale] duration-(--duration-fast)'

type TransportProps = {
  loop?: boolean
  stems?: boolean
  best?: string | undefined
  prompting?: boolean
  onLoopHint?: () => void
}

function Transport({
  loop = true,
  stems = true,
  best = COPY.bestTempo,
  prompting = false,
  onLoopHint = fn(),
}: TransportProps) {
  const [playing, setPlaying] = useState(false)
  const [loopOn, setLoopOn] = useState(true)
  const [countIn, setCountIn] = useState(false)
  const [mix, setMix] = useState(false)
  const [speed, setSpeed] = useState(70)
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <fieldset aria-label="Position" className="m-0 flex items-center gap-2 border-0 p-0">
          <TransportButton
            icon={<SkipBackIcon aria-hidden />}
            label="Restart loop"
            showLabel={false}
            shortcut="R"
          />
          <TransportButton
            tone="primary"
            className="min-h-18 min-w-18 rounded-full"
            icon={
              <span className="grid place-items-center">
                <PauseIcon
                  aria-hidden
                  className={cn(FADE, playing ? 'scale-100' : 'scale-75 opacity-0')}
                />
                <PlayIcon
                  aria-hidden
                  className={cn(FADE, playing ? 'scale-75 opacity-0' : 'scale-100')}
                />
              </span>
            }
            label={playing ? 'Pause' : 'Play'}
            showLabel={false}
            shortcut="Space"
            onClick={() => setPlaying(!playing)}
          />
        </fieldset>
        <fieldset
          aria-label="Loop"
          className="m-0 flex min-w-0 items-center gap-1 rounded-2xl border-0 bg-surface-sunken p-1"
        >
          {loop ? (
            <TransportButton
              icon={<RepeatIcon aria-hidden />}
              label="Loop"
              showLabel={false}
              shortcut="L"
              pressed={loopOn}
              onPressedChange={setLoopOn}
            />
          ) : (
            <TransportButton
              icon={<RepeatIcon aria-hidden />}
              label="Loop"
              showLabel={false}
              shortcut="L"
              onClick={onLoopHint}
            />
          )}
          <LoopBadge
            state={loop ? (loopOn ? 'active' : 'off') : 'off'}
            className="min-h-target-practice rounded-xl text-read-label"
          >
            {loop ? 'Loop · bars 17–20 · pass 3' : 'No loop — tap two bars'}
          </LoopBadge>
        </fieldset>
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
        <fieldset
          aria-label="Practice helpers"
          className="m-0 flex items-center gap-2 border-0 p-0"
        >
          <TransportButton
            size="practice-2"
            icon={<CountInIcon aria-hidden />}
            label="Count-in"
            showLabel="wide"
            shortcut="C"
            pressed={countIn}
            onPressedChange={setCountIn}
          />
          <TransportButton
            size="practice-2"
            icon={<MetronomeIcon aria-hidden />}
            label="Metronome"
            showLabel="wide"
            pressed={false}
            onPressedChange={fn()}
          />
          <TransportButton
            size="practice-2"
            icon={<SlidersVerticalIcon aria-hidden />}
            label="Mix"
            showLabel="wide"
            pressed={mix && stems}
            disabled={!stems}
            onPressedChange={setMix}
          />
        </fieldset>
      </div>
      <PassControl
        className={cn('ml-auto shrink-0', !loop && 'invisible')}
        inert={!loop}
        prompting={prompting}
        question="How was pass 3?"
        labels={{ prompt: COPY.passPrompt, clean: COPY.feltClean, notYet: COPY.notYet }}
        best={best}
        shortcuts={{ clean: 'C', notYet: 'N' }}
        onClean={fn()}
        onNotYet={fn()}
      />
    </div>
  )
}

export const Default: Story = { render: () => <Transport /> }

/** Acceptance (doc 26 §8): practice targets measure at least 64 × 64, practice-2 at least 48. */
export const Targets: Story = {
  render: () => <Transport />,
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

/** At the stand every helper shows its label; the transport set stays icons with tooltips. */
export const LabelsAtTheStand: Story = {
  render: () => <Transport />,
  globals: { distance: 'stand', density: 'practice' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const countIn = canvas.getByRole('button', { name: 'Count-in' })
    await expect(within(countIn).getByText('Count-in')).toBeVisible()
    await expect(
      within(canvas.getByRole('button', { name: 'Play' })).queryByText('Play'),
    ).toBeNull()
  },
}

export const KeyboardSpeed: Story = {
  render: () => <Transport />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await expect(canvas.getByRole('button', { name: /^Speed: 75/ })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    fireEvent.click(canvas.getByRole('button', { name: 'Slower' }), { shiftKey: true })
    await expect(canvas.getByRole('button', { name: /^Speed: 79/ })).toBeInTheDocument()
    // The number counts up to it; the accessibility check waits for it to settle.
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /^Speed: / })).toHaveTextContent(/^79/),
    )
  },
}

/** Labelled groups: position, the loop (toggle joined to its badge) and the helpers. */
export const Groups: Story = {
  render: () => <Transport />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const position = canvas.getByRole('group', { name: 'Position' })
    await expect(
      within(position)
        .getAllByRole('button')
        .map((b) => b.ariaLabel),
    ).toEqual(['Restart loop', 'Play'])
    const loop = canvas.getByRole('group', { name: 'Loop' })
    await expect(within(loop).getByRole('button', { name: 'Loop' })).toBeVisible()
    await expect(within(loop).getByRole('button', { name: /^Loop · bars/ })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /^Speed: / })).toBeVisible()
    const helpers = canvas.getByRole('group', { name: 'Practice helpers' })
    await expect(within(helpers).getAllByRole('button')).toHaveLength(3)
  },
}

/** Wide screens label the helpers at desk distance too; the transport set stays icons (26 §11). */
export const LabelsWhenWide: Story = {
  render: () => <Transport />,
  parameters: WIDE_VIEWPORTS,
  globals: { distance: 'desk', ...WIDE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of ['Count-in', 'Metronome', 'Mix']) {
      await expect(within(canvas.getByRole('button', { name })).getByText(name)).toBeVisible()
    }
    for (const name of ['Play', 'Slower']) {
      await expect(within(canvas.getByRole('button', { name })).queryByText(name)).toBeNull()
    }
  },
}

/** From `2xl` the presets sit inline, the current speed pressed; the readout keeps the slider. */
export const InlinePresets: Story = {
  render: () => <Transport />,
  globals: WIDE,
  parameters: WIDE_VIEWPORTS,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const presets = await canvas.findByRole('group', { name: 'Speed presets' }, { timeout: 10_000 })
    await expect(within(presets).getByRole('button', { name: /^70/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(within(presets).getByRole('button', { name: /^85/ }))
    await expect(canvas.getByRole('button', { name: /^Speed: 85/ })).toBeInTheDocument()
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /^Speed: / })).toHaveTextContent(/^85/),
    )
    await expect(within(presets).getByRole('button', { name: /^85/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(within(presets).getByRole('button', { name: /^70/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  },
}
export const InlinePresetsDark: Story = {
  render: () => <Transport />,
  globals: { ...WIDE, appearance: 'dark' },
  parameters: WIDE_VIEWPORTS,
}
export const InlinePresetsStage: Story = {
  render: () => <Transport />,
  globals: { ...WIDE, appearance: 'stage', distance: 'stand' },
  parameters: WIDE_VIEWPORTS,
}

/** Below `2xl` there are no inline presets: the readout's popover has them. */
export const NoInlinePresetsOnTablets: Story = {
  render: () => <Transport />,
  globals: TABLET,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('group', { name: 'Speed presets' })).toBeNull()
  },
}

/** The icon cross-fades between Play and Pause; the name stays exactly one of the two. */
export const PlayPause: Story = {
  render: () => <Transport />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }))
    await expect(canvas.getByRole('button', { name: 'Pause' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Play' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }))
    await expect(canvas.getByRole('button', { name: 'Play' })).toBeVisible()
  },
}

/** Mix keeps its place and waits for the stems. */
export const MixBeforeStems: Story = {
  render: () => <Transport stems={false} />,
  play: async ({ canvasElement }) => {
    const mix = within(canvasElement).getByRole('button', { name: 'Mix' })
    await expect(mix).toBeVisible()
    await expect(mix).toBeDisabled()
  },
}

/** With no loop the Loop button works as a hint, not a toggle. */
const onLoopHint = fn()
export const LoopWithoutLoop: Story = {
  render: () => <Transport loop={false} best={undefined} onLoopHint={onLoopHint} />,
  play: async ({ canvasElement }) => {
    const loop = within(canvasElement).getByRole('button', { name: 'Loop' })
    await expect(loop).toBeEnabled()
    await expect(loop).not.toHaveAttribute('aria-pressed')
    await userEvent.click(loop)
    await expect(onLoopHint).toHaveBeenCalledTimes(1)
  },
}

/** No loop yet: the pass pair keeps its room, hidden and out of reach. */
export const PassSlotReserved: Story = {
  render: () => <Transport loop={false} best={undefined} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const pass = canvasElement.querySelector<HTMLElement>('[data-slot=pass-control]')
    await expect(pass).not.toBeNull()
    await expect(pass).not.toBeVisible()
    await expect(pass).toHaveAttribute('inert')
    await expect(pass?.getBoundingClientRect().width).toBeGreaterThan(0)
    await expect(canvas.queryByRole('button', { name: 'Felt clean' })).toBeNull()
  },
}
export const PassSlotShown: Story = {
  render: () => <Transport />,
  play: async ({ canvasElement }) => {
    const pass = canvasElement.querySelector<HTMLElement>('[data-slot=pass-control]')
    await expect(pass).toBeVisible()
    await expect(pass).not.toHaveAttribute('inert')
    await expect(within(canvasElement).getByRole('button', { name: 'Felt clean' })).toBeEnabled()
  },
}

function NewBest() {
  const [best, setBest] = useState(70)
  return (
    <PassControl
      labels={{ prompt: COPY.passPrompt, clean: COPY.feltClean, notYet: COPY.notYet }}
      best={`Best clean pass: ${best} %`}
      onClean={() => setBest(85)}
      onNotYet={fn()}
    />
  )
}

/** A new best draws a tick before it; the best a song opens with has none. */
export const PassNewBest: Story = {
  render: () => <NewBest />,
  play: async ({ canvasElement }) => {
    const tick = () => canvasElement.querySelector('.lucide-check-draw')
    await expect(tick()).toBeNull()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Felt clean' }))
    await waitFor(() => expect(tick()).not.toBeNull())
    await expect(within(canvasElement).getByText('Best clean pass: 85 %')).toBeVisible()
  },
}

/** A pass waiting for its answer rings the tray. */
export const PassPrompting: Story = {
  render: () => <Transport prompting />,
  play: async ({ canvasElement }) => {
    const pass = canvasElement.querySelector<HTMLElement>('[data-slot=pass-control]')
    await expect(pass).toHaveClass('ring-2')
  },
}

/** The speed number counts to the new value; the name states it at once. */
export const SpeedTween: Story = {
  render: () => <Transport />,
  globals: { motion: 'full' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await expect(canvas.getByRole('button', { name: /^Speed: 75/ })).toBeInTheDocument()
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /^Speed: / })).toHaveTextContent(/^75/),
    )
  },
}
export const SpeedJumpsUnderReducedMotion: Story = {
  render: () => <Transport />,
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Faster' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /^Speed: / })).toHaveTextContent(/^75/),
    )
  },
}

function HudDemo() {
  const [sequence, setSequence] = useState(1)
  return (
    <>
      <button type="button" onClick={() => setSequence(sequence + 1)}>
        Again
      </button>
      <PedalHud message="Loop on" sequence={sequence} icon={<RepeatIcon aria-hidden />} />
    </>
  )
}

/** Each press pops the HUD in again, even with the same text. */
export const PedalHudRepeats: Story = {
  render: () => <HudDemo />,
  play: async ({ canvasElement }) => {
    const hud = () => canvasElement.ownerDocument.querySelector('[data-slot=pedal-hud]')
    await waitFor(() => expect(hud()).toHaveAttribute('data-visible'))
    const first = hud()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Again' }))
    await waitFor(() => expect(hud()).not.toBe(first))
    await expect(hud()).toHaveTextContent('Loop on')
  },
}
export const PedalHudStage: Story = { render: () => <HudDemo />, globals: { appearance: 'stage' } }

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
  </div>
)
export const Dark: Story = { render: Gallery, globals: { appearance: 'dark' } }
export const Stage: Story = { render: Gallery, globals: { appearance: 'stage', distance: 'stand' } }
export const IncreasedContrast: Story = { render: Gallery, globals: { contrast: 'more' } }
export const PracticeDensity: Story = {
  render: Gallery,
  globals: { density: 'practice', distance: 'floor' },
}
