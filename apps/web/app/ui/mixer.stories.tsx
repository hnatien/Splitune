import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { OptionSegments } from '../features/common/option-segments.tsx'
import { PanelSection } from '../features/common/panel-section.tsx'
import { COPY, FIXTURE_STEMS } from './fixtures.ts'
import { LoopBadge } from './loop-badge.tsx'
import { Meter, MeterLabel, MeterValue } from './meter.tsx'
import { type MixPreset, MixPresetGroup } from './mix-preset-group.tsx'
import { StemRow, StemRowSkeleton, StemToggle } from './stem-row.tsx'

const meta = { title: 'Kit/Mixer' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const LABELS = {
  mute: 'Mute',
  solo: 'Solo',
  volume: 'Volume',
  decrease: 'Quieter',
  increase: 'Louder',
  muted: 'muted',
  soloed: 'solo',
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
    <div className="flex max-w-3xl flex-col gap-4 rounded-field border border-border bg-raised p-4">
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
    <div className="flex w-88 max-w-full flex-col gap-3 rounded-panel border border-border bg-raised p-4 text-foreground">
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
    canvas.getByRole('slider', { name: 'Volume Drums' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    // The readout says it, and opens a stepper for setting it without a drag (WCAG 2.5.7).
    const readout = canvas.getByRole('button', { name: /^Volume Drums: −7\sdB$/ })
    await userEvent.click(readout)
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole('textbox', { name: 'Volume Drums' })).toHaveValue('-7')
  },
}

export const Daylight: Story = { render: Gallery, globals: { appearance: 'light' } }
export const Stage: Story = {
  render: Gallery,
  globals: { appearance: 'stage', density: 'practice' },
}
export const IncreasedContrast: Story = { render: Gallery, globals: { contrast: 'more' } }

// Every stem of a six-stem run (26 §12.2 "all stems s40b"): your part first, Rhythm only offered,
// a Rough stem, one soloed and one muted, and names longer than the row.
const ALL_STEMS = [
  { id: 'guitar', stem: 'guitar', name: 'Guitar', gain: 0, solo: false, muted: false },
  { id: 'vocals', stem: 'vocals', name: 'Vocals', gain: -6, solo: false, muted: true },
  { id: 'bass', stem: 'bass', name: 'Bass', gain: -6, solo: true, muted: false },
  { id: 'drums', stem: 'drums', name: 'Drums', gain: -2, solo: false, muted: false },
  { id: 'keys', stem: 'keys', name: 'Piano', gain: -4, solo: false, muted: false, rough: true },
  { id: 'other', stem: 'other', name: 'Other', gain: -6, solo: false, muted: false },
] as const

type StemState = { muted: boolean; soloed: boolean; gain: number }

function AllStems({ long = false }: { long?: boolean }) {
  const [preset, setPreset] = useState<MixPreset | null>(null)
  const [state, setState] = useState<Record<string, StemState>>(() =>
    Object.fromEntries(
      ALL_STEMS.map((s) => [s.id, { muted: s.muted, soloed: s.solo, gain: s.gain }]),
    ),
  )
  const set = (id: string, patch: Partial<StemState>) =>
    setState((current) => ({
      ...current,
      [id]: { muted: false, soloed: false, gain: 0, ...current[id], ...patch },
    }))
  return (
    <div className="flex w-95 max-w-full flex-col gap-4 rounded-field border border-border bg-raised p-4">
      <MixPresetGroup
        label="Mix"
        value={preset}
        onValueChange={setPreset}
        options={[
          { value: 'part-loud', label: 'Your part loud', gloss: 'Learn it: guitar up, band down' },
          { value: 'minus-one', label: 'Minus-one', gloss: 'Play it: your part muted' },
          { value: 'original', label: 'Original', gloss: 'The song as recorded' },
          { value: 'rhythm', label: 'Rhythm only', gloss: 'Bass and drums, nothing else' },
        ]}
      />
      <div className="flex flex-col gap-0.5">
        {ALL_STEMS.map((stem) => (
          <StemRow
            key={stem.id}
            stem={stem.stem}
            name={long ? `${stem.name} (left channel, doubled an octave up)` : stem.name}
            yourPart={stem.id === 'guitar' ? COPY.yourPart : undefined}
            rough={'rough' in stem ? { label: COPY.rough, reason: COPY.roughStem } : undefined}
            muted={state[stem.id]?.muted ?? false}
            soloed={state[stem.id]?.soloed ?? false}
            gainDb={state[stem.id]?.gain ?? 0}
            onMutedChange={(muted) => set(stem.id, { muted })}
            onSoloedChange={(soloed) => set(stem.id, { soloed })}
            onGainChange={(gain) => set(stem.id, { gain })}
            labels={LABELS}
          />
        ))}
      </div>
    </div>
  )
}

export const AllStemsS40b: Story = {
  render: () => <AllStems />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('radio')).toHaveLength(4)
    await expect(canvas.getByRole('button', { name: 'Volume Bass: solo' })).toHaveTextContent(
      'solo',
    )
    await expect(canvas.getByRole('button', { name: 'Volume Vocals: muted' })).toHaveTextContent(
      'muted',
    )
    // Solo wins over mute, so the readout says solo when both are on.
    await userEvent.click(canvas.getByRole('button', { name: 'Solo Vocals' }))
    await expect(canvas.getByRole('button', { name: 'Volume Vocals: solo' })).toBeVisible()
    await userEvent.click(canvas.getByRole('radio', { name: /^Rhythm only/ }))
    await expect(canvas.getByRole('radio', { name: /^Rhythm only/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  },
}
export const AllStemsS40bDaylight: Story = {
  ...AllStemsS40b,
  globals: { appearance: 'light' },
}
export const AllStemsS40bIncreasedContrast: Story = {
  ...AllStemsS40b,
  globals: { contrast: 'more' },
}

/** Long names truncate; the badges, M/S and the readout keep their room and their 48 boxes. */
export const LongStemNames: Story = {
  render: () => <AllStems long />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const toggle of canvas.getAllByRole('button', { name: /^(Mute|Solo) / })) {
      const box = toggle.getBoundingClientRect()
      await expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48)
    }
    await expect(canvas.getByText('Your part')).toBeVisible()
    await expect(canvas.getByText('Rough')).toBeVisible()
  },
}
export const LongStemNamesDaylight: Story = { ...LongStemNames, globals: { appearance: 'light' } }

/** The Tools sheet's M (27 §3.7.2): painted 44 inside its 48 box; on = filled. */
export const ToolsMute: Story = {
  render: function Render() {
    const [muted, setMuted] = useState(false)
    return (
      <StemToggle size="tools" pressed={muted} onPressedChange={setMuted} label="Mute Band">
        M
      </StemToggle>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mute = canvas.getByRole('button', { name: 'Mute Band' })
    const box = mute.getBoundingClientRect()
    await expect(box.width).toBeGreaterThanOrEqual(48)
    const face = (mute.firstElementChild as HTMLElement).getBoundingClientRect()
    await expect(face.width).toBe(44)
    await userEvent.click(mute)
    await expect(mute).toHaveAttribute('aria-pressed', 'true')
  },
}
export const ToolsMuteDaylight: Story = { ...ToolsMute, globals: { appearance: 'light' } }
