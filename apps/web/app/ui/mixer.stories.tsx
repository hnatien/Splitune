import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { OptionSegments } from '../features/common/option-segments.tsx'
import { PanelSection } from '../features/common/panel-section.tsx'
import { COPY, FIXTURE_STEMS } from './fixtures.ts'
import { LoopBadge } from './loop-badge.tsx'
import { Meter, MeterLabel, MeterValue } from './meter.tsx'
import { type MixPreset, MixPresetGroup } from './mix-preset-group.tsx'
import { StemRow, StemRowSkeleton } from './stem-row.tsx'

const meta = { title: 'Kit/Mixer' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const LABELS = {
  mute: 'Mute',
  solo: 'Solo',
  volume: 'Volume',
  decrease: 'Quieter',
  increase: 'Louder',
}

const GLOSS = {
  'part-loud': 'Your part louder than the rest',
  'minus-one': 'Your part muted — you play it',
  original: 'The song as it was recorded',
}

function Mixer({ loading = false }: { loading?: boolean }) {
  const [preset, setPreset] = useState<MixPreset | null>('part-loud')
  const [state, setState] = useState(() =>
    Object.fromEntries(
      FIXTURE_STEMS.map((stem) => [
        stem.id,
        { muted: false, soloed: false, gain: stem.id === 'guitar' ? 0 : -6 },
      ]),
    ),
  )
  const update = (
    id: string,
    patch: Partial<{ muted: boolean; soloed: boolean; gain: number }>,
  ) => {
    setPreset(null)
    setState((current) => ({
      ...current,
      [id]: { muted: false, soloed: false, gain: 0, ...current[id], ...patch },
    }))
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <MixPresetGroup
        label="Mix"
        value={preset}
        onValueChange={setPreset}
        options={[
          { value: 'part-loud', label: 'Your part loud', gloss: GLOSS['part-loud'] },
          { value: 'minus-one', label: 'Minus-one', gloss: GLOSS['minus-one'] },
          { value: 'original', label: 'Original', gloss: GLOSS.original },
        ]}
      />
      <div className="flex flex-col gap-2">
        {FIXTURE_STEMS.map((stem) =>
          loading ? (
            <StemRowSkeleton key={stem.id} />
          ) : (
            <StemRow
              key={stem.id}
              stem={stem.stem}
              name={stem.name}
              yourPart={stem.id === 'guitar' ? COPY.yourPart : undefined}
              rough={stem.rough ? { label: COPY.rough, reason: COPY.roughStem } : undefined}
              muted={state[stem.id]?.muted ?? false}
              soloed={state[stem.id]?.soloed ?? false}
              gainDb={state[stem.id]?.gain ?? 0}
              onMutedChange={(muted) => update(stem.id, { muted })}
              onSoloedChange={(soloed) => update(stem.id, { soloed })}
              onGainChange={(gain) => update(stem.id, { gain })}
              labels={LABELS}
            />
          ),
        )}
      </div>
    </div>
  )
}

function LoopBadgeStates() {
  return (
    <div className="flex flex-wrap gap-3">
      <LoopBadge state="off">No loop — tap two bars</LoopBadge>
      <LoopBadge state="armed">Loop · from bar 17, tap the last bar</LoopBadge>
      <LoopBadge state="active">Loop · bars 17–20 · pass 3</LoopBadge>
      <LoopBadge state="resting">Loop · bars 17–20 · pass 3</LoopBadge>
    </div>
  )
}

function PanelTiles() {
  const [rest, setRest] = useState('beat')
  const [appearance, setAppearance] = useState('system')
  return (
    <div className="flex w-88 max-w-full flex-col gap-3 rounded-2xl border border-border bg-popover p-4 text-popover-foreground">
      <PanelSection title="Between repeats">
        <OptionSegments
          label="Rest between repeats"
          value={rest}
          options={[
            { value: 'none', label: 'None' },
            { value: 'beat', label: 'One beat' },
            { value: 'bar', label: 'One bar' },
          ]}
          onChange={setRest}
        />
      </PanelSection>
      <PanelSection title="Look">
        <OptionSegments
          label="Appearance"
          value={appearance}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'stage', label: 'Stage' },
          ]}
          onChange={setAppearance}
        />
        <Meter value={3} min={0} max={5} getAriaValueText={() => '3 of 5'}>
          <MeterLabel>Level</MeterLabel>
          <MeterValue />
        </Meter>
      </PanelSection>
    </div>
  )
}

function Gallery() {
  return (
    <div className="flex flex-col gap-6">
      <Mixer />
      <LoopBadgeStates />
      <PanelTiles />
    </div>
  )
}

export const Default: Story = { render: Gallery }
export const LoopBadges: Story = {
  render: () => <LoopBadgeStates />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const badges = canvas.getAllByRole('button')
    await expect(badges.map((badge) => badge.getAttribute('data-state'))).toEqual([
      'off',
      'armed',
      'active',
      'resting',
    ])
    await expect(getComputedStyle(badges[1] as HTMLElement).borderStyle).toBe('dashed')
    await expect(getComputedStyle(badges[2] as HTMLElement).borderStyle).toBe('solid')
  },
}
export const PanelSections: Story = {
  render: () => <PanelTiles />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('group', { name: 'Rest between repeats' })
    const beat = within(group).getByRole('button', { name: 'One beat' })
    await expect(beat).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(group).getByRole('button', { name: 'One bar' }))
    await expect(within(group).getByRole('button', { name: 'One bar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(beat).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(within(group).getByRole('button', { name: 'One bar' }))
    await expect(within(group).getByRole('button', { name: 'One bar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}
export const Loading: Story = { render: () => <Mixer loading /> }

/** The presets as radio cards (26 §12.2): each names what it does; checked = wash + 2 px edge. */
export const PresetGloss: Story = {
  render: () => <Mixer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = canvas.getByRole('radiogroup', { name: 'Mix' })
    for (const gloss of Object.values(GLOSS))
      await expect(within(group).getByText(gloss)).toBeVisible()
    const minusOne = canvas.getByRole('radio', { name: /^Minus-one/ })
    await userEvent.click(minusOne)
    await expect(minusOne).toHaveAttribute('aria-checked', 'true')
    await expect(canvas.getByRole('radio', { name: /^Your part loud/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    // A checked card's edge is 2 px (1 px border + 1 px inset ring), never colour alone.
    await expect(getComputedStyle(minusOne).borderTopWidth).toBe('1px')
    await expect(getComputedStyle(minusOne).boxShadow).not.toBe('none')
  },
}

export const MuteAndSolo: Story = {
  render: () => <Mixer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mute = canvas.getByRole('button', { name: 'Mute Drums' })
    await userEvent.click(mute)
    await expect(mute).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('radio', { name: /^Your part loud/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    const box = mute.getBoundingClientRect()
    await expect(box.width).toBeGreaterThanOrEqual(48)
    await expect(box.height).toBeGreaterThanOrEqual(48)
  },
}

export const GainByKeyboard: Story = {
  render: () => <Mixer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('slider', { name: 'Volume Bass' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    // The readout says it, and opens a stepper for setting it without a drag (WCAG 2.5.7).
    const readout = canvas.getByRole('button', { name: /^Volume Bass: −7\sdB$/ })
    await userEvent.click(readout)
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole('textbox', { name: 'Volume Bass' })).toHaveValue('-7')
  },
}

export const Daylight: Story = { render: Gallery, globals: { appearance: 'light' } }
export const Stage: Story = {
  render: Gallery,
  globals: { appearance: 'stage', density: 'practice' },
}
export const IncreasedContrast: Story = { render: Gallery, globals: { contrast: 'more' } }
