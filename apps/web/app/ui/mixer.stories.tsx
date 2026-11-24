import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { OptionSegments } from '../features/common/option-segments.tsx'
import { PanelSection } from '../features/common/panel-section.tsx'
import {
  COPY,
  contrastRatio,
  FIXTURE_STEMS,
  inkEdgeOf,
  rgbOf,
  sameColour,
  surfaceOf,
  tokenColour,
} from './fixtures.ts'
import { Meter, MeterLabel, MeterValue } from './meter.tsx'
import { type MixPreset, MixPresetGroup } from './mix-preset-group.tsx'
import { StemRow, StemRowSkeleton, StemToggle } from './stem-row.tsx'
import { BOTH_THEMES, expectTargets, themeFrames } from './story-kit.tsx'

// Doc 26 §12.2, s47 direction §6 (practice--mixer-open): the mix presets as rows with a check,
// then one row per stem: its colour rule beside its name, M and S as inverted 48 px letter
// toggles, and the fader with a readout that says the state in words.
const meta = { title: 'Kit/Mixer' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const VIEWPORTS = {
  viewport: {
    options: {
      phone: { name: 'Phone 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
    },
  },
}
const PHONE = { viewport: { value: 'phone', isRotated: false }, pointer: 'coarse' } as const

const LABELS = {
  mute: 'Mute',
  solo: 'Solo',
  volume: 'Volume',
  decrease: 'Quieter',
  increase: 'Louder',
  muted: 'Muted',
  soloed: 'solo',
  notHeard: 'Not heard',
}

const PRESETS: { value: MixPreset; label: string; gloss: string }[] = [
  { value: 'part-loud', label: 'Your part loud', gloss: 'Guitar +6 dB, the band −6 dB' },
  { value: 'minus-one', label: 'Minus-one', gloss: 'Guitar muted: you play it' },
  { value: 'original', label: 'Original', gloss: 'Every stem at 0 dB' },
  { value: 'rhythm', label: 'Rhythm only', gloss: 'Bass and drums' },
]

// Every stem of a six-stem run: your part first, a Rough stem, names that may run long.
const STEMS = [
  { id: 'guitar', stem: 'guitar', name: 'Guitar', gain: 6 },
  { id: 'vocals', stem: 'vocals', name: 'Vocals', gain: -6 },
  { id: 'bass', stem: 'bass', name: 'Bass', gain: -6 },
  { id: 'drums', stem: 'drums', name: 'Drums', gain: -2 },
  { id: 'keys', stem: 'keys', name: 'Piano', gain: -4, rough: true },
  { id: 'other', stem: 'other', name: 'Other', gain: -6 },
] as const

type StemState = { muted: boolean; soloed: boolean; gain: number }

function Mixer({
  long = false,
  initial = {},
  loading = false,
}: {
  long?: boolean
  initial?: Record<string, Partial<StemState>>
  loading?: boolean
}) {
  const [preset, setPreset] = useState<MixPreset | null>('part-loud')
  const [state, setState] = useState<Record<string, StemState>>(() =>
    Object.fromEntries(
      STEMS.map((s) => [s.id, { muted: false, soloed: false, gain: s.gain, ...initial[s.id] }]),
    ),
  )
  const anySolo = Object.values(state).some((s) => s.soloed)
  const set = (id: string, patch: Partial<StemState>) => {
    setPreset(null)
    setState((current) => ({
      ...current,
      [id]: { muted: false, soloed: false, gain: 0, ...current[id], ...patch },
    }))
  }
  return (
    <div className="flex w-85 max-w-full flex-col gap-4 bg-panel py-3">
      <div className="flex flex-col gap-1.5 px-2">
        <h3 className="px-3 text-caption text-muted-foreground">Presets</h3>
        <MixPresetGroup
          label="Mix presets"
          value={preset}
          onValueChange={setPreset}
          options={PRESETS}
        />
      </div>
      <div className="flex flex-col px-2">
        <h3 className="px-3 pb-1 text-caption text-muted-foreground">Stems · 6</h3>
        {STEMS.map((stem) =>
          loading ? (
            <StemRowSkeleton key={stem.id} />
          ) : (
            <StemRow
              key={stem.id}
              stem={stem.stem}
              name={long ? `${stem.name} (left channel, doubled an octave up)` : stem.name}
              yourPart={stem.id === 'guitar' ? COPY.yourPart : undefined}
              rough={'rough' in stem ? { label: COPY.rough, reason: COPY.roughStem } : undefined}
              muted={state[stem.id]?.muted ?? false}
              soloed={state[stem.id]?.soloed ?? false}
              notHeard={anySolo && !state[stem.id]?.soloed}
              gainDb={state[stem.id]?.gain ?? 0}
              onMutedChange={(muted) => set(stem.id, { muted })}
              onSoloedChange={(soloed) => set(stem.id, { soloed })}
              onGainChange={(gain) => set(stem.id, { gain })}
              labels={LABELS}
              className="border-b border-border last:border-b-0"
            />
          ),
        )}
      </div>
    </div>
  )
}

const row = (root: HTMLElement, name: string) =>
  within(root)
    .getByRole('button', { name: `Mute ${name}` })
    .closest('[data-slot=stem-row]') as HTMLElement
const readout = (root: HTMLElement, name: string) =>
  within(root).getByRole('button', { name: new RegExp(`^Volume ${name}: `) })

export const Default: Story = { render: () => <Mixer />, globals: BOTH_THEMES }

/** The presets are rows: the chosen one has the 1.5 px ink edge and a check, ≥ 3:1. */
export const Presets: Story = {
  render: () => <Mixer />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const group = canvas.getByRole('radiogroup', { name: 'Mix presets' })
      for (const preset of PRESETS)
        await expect(within(group).getByText(preset.gloss)).toBeVisible()
      const minusOne = canvas.getByRole('radio', { name: /^Minus-one/ })
      await userEvent.click(minusOne)
      await userEvent.unhover(minusOne)
      await expect(minusOne).toHaveAttribute('aria-checked', 'true')
      await expect(canvas.getByRole('radio', { name: /^Your part loud/ })).toHaveAttribute(
        'aria-checked',
        'false',
      )
      await waitFor(async () => {
        const edge = inkEdgeOf(minusOne)
        await expect(edge.width).toBe(1.5)
        await expect(edge.contrast).toBeGreaterThanOrEqual(3)
        await expect(edge.fill).toBe(0)
      })
      await expect(minusOne.querySelector('.lucide-check')).toBeVisible()
      await expect(
        canvas.getByRole('radio', { name: /^Original/ }).querySelector('.lucide-check'),
      ).toBeNull()
      await expectTargets(canvas.getAllByRole('radio'), 44)
    }
  },
}

/** Each stem's colour rule runs beside its name; the name is always there too. */
export const StemRules: Story = {
  render: () => <Mixer />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      for (const stem of STEMS) {
        const line = row(frame, stem.name)
        const rule = line.querySelector('[data-slot=stem-rule]') as HTMLElement
        const box = rule.getBoundingClientRect()
        await expect(Math.round(box.width)).toBe(4)
        await expect(box.height).toBeGreaterThanOrEqual(48)
        const colour = tokenColour(`--stem-${stem.stem}`, frame)
        await expect(sameColour(getComputedStyle(rule).backgroundColor, colour)).toBe(true)
        await expect(contrastRatio(colour, surfaceOf(rule))).toBeGreaterThanOrEqual(3)
        await expect(within(line).getByText(stem.name)).toBeVisible()
      }
    }
  },
}

/** M and S are 48 px letter toggles; on is the ink fill (an inversion), ≥ 3:1 on the panel. */
export const MuteAndSolo: Story = {
  render: () => <Mixer />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const toggles = canvas.getAllByRole('button', { name: /^(Mute|Solo) / })
      await expect(toggles).toHaveLength(12)
      await expectTargets(toggles, 48)
      const mute = canvas.getByRole('button', { name: 'Mute Drums' })
      await userEvent.click(mute)
      await userEvent.unhover(mute)
      await expect(mute).toHaveAttribute('aria-pressed', 'true')
      await waitFor(async () => {
        const style = getComputedStyle(mute)
        await expect(sameColour(style.backgroundColor, tokenColour('--primary', mute))).toBe(true)
        await expect(sameColour(style.color, tokenColour('--primary-foreground', mute))).toBe(true)
        await expect(contrastRatio(style.backgroundColor, surfaceOf(mute))).toBeGreaterThanOrEqual(
          3,
        )
      })
      // The readout says it in words, and the row's name dims to faint text, never by opacity.
      await expect(readout(frame, 'Drums')).toHaveTextContent('Muted')
      const name = within(row(frame, 'Drums')).getByText('Drums')
      await expect(
        sameColour(getComputedStyle(name).color, tokenColour('--faint-foreground', name)),
      ).toBe(true)
      await expect(getComputedStyle(row(frame, 'Drums')).opacity).toBe('1')
      // Touching a stem leaves the preset behind.
      await expect(canvas.getByRole('radio', { name: /^Your part loud/ })).toHaveAttribute(
        'aria-checked',
        'false',
      )
    }
  },
}

/** Soloing one stem: it reads "−6 dB · solo", every other stem dims and says "Not heard". */
export const SoloDimsTheRest: Story = {
  render: () => <Mixer />,
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Solo Bass' }))
    await expect(readout(canvasElement, 'Bass')).toHaveTextContent('−6 dB · solo')
    for (const stem of STEMS.filter((s) => s.name !== 'Bass')) {
      await expect(readout(canvasElement, stem.name)).toHaveAccessibleName(
        `Volume ${stem.name}: Not heard`,
      )
      await expect(row(canvasElement, stem.name)).toHaveAttribute('data-heard', 'false')
    }
    await expect(row(canvasElement, 'Bass')).toHaveAttribute('data-heard', 'true')
    // Solo wins over mute: a soloed stem plays even when muted, so it still says solo.
    await userEvent.click(canvas.getByRole('button', { name: 'Mute Bass' }))
    await expect(readout(canvasElement, 'Bass')).toHaveTextContent('−6 dB · solo')
  },
}
export const SoloDimsTheRestDark: Story = { ...SoloDimsTheRest, globals: { appearance: 'dark' } }

/** The readouts hold their width as the level changes; the level is tabular. */
export const GainByKeyboard: Story = {
  render: () => <Mixer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const before = readout(canvasElement, 'Drums').getBoundingClientRect().width
    canvas.getByRole('slider', { name: 'Volume Drums' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    // The readout says it, and opens a stepper for setting it without a drag (WCAG 2.5.7).
    const level = canvas.getByRole('button', { name: /^Volume Drums: −3\sdB$/ })
    await expect(level.getBoundingClientRect().width).toBe(before)
    await expect(getComputedStyle(level).fontVariantNumeric).toContain('tabular-nums')
    await userEvent.click(level)
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole('textbox', { name: 'Volume Drums' })).toHaveValue('-3')
  },
}

/** Long names truncate; the tags, M/S and the readout keep their room and their 48 px. */
export const LongStemNames: Story = {
  render: () => <Mixer long />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      await expectTargets(canvas.getAllByRole('button', { name: /^(Mute|Solo) / }), 48)
      await expect(canvas.getByText('Your part')).toBeVisible()
      await expect(canvas.getByText('Rough')).toBeVisible()
      for (const line of frame.querySelectorAll<HTMLElement>('[data-slot=stem-row]')) {
        await expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth)
      }
    }
  },
}

/** The Rough tag is a glyph and a word, with the reason in its name and tooltip. */
export const RoughStem: Story = {
  render: () => <Mixer />,
  play: async ({ canvasElement }) => {
    const rough = within(row(canvasElement, 'Piano')).getByText('Rough').closest('[data-kind]')
    await expect(rough).toHaveAttribute('data-kind', 'attention')
    await expect(rough).toHaveTextContent(`Rough: ${COPY.roughStem}`)
  },
}

/** A phone's sheet at 375 px: nothing overflows, every toggle keeps 48 px. */
export const Phone: Story = {
  render: () => <Mixer long />,
  parameters: { ...VIEWPORTS, layout: 'fullscreen' },
  globals: { ...PHONE, appearance: 'light' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expectTargets(canvas.getAllByRole('button', { name: /^(Mute|Solo) / }), 48)
    for (const line of canvasElement.querySelectorAll<HTMLElement>('[data-slot=stem-row]')) {
      await expect(line.getBoundingClientRect().right).toBeLessThanOrEqual(375)
      await expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth)
    }
  },
}
export const PhoneDark: Story = { ...Phone, globals: { ...PHONE, appearance: 'dark' } }

export const Loading: Story = { render: () => <Mixer loading />, globals: BOTH_THEMES }

/** The phone Tools sheet's M: the same inverted 48 px toggle. */
export const ToolsMute: Story = {
  globals: BOTH_THEMES,
  render: function Render() {
    const [muted, setMuted] = useState(false)
    return (
      <StemToggle size="tools" pressed={muted} onPressedChange={setMuted} label="Mute Band">
        M
      </StemToggle>
    )
  },
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const mute = within(frame).getByRole('button', { name: 'Mute Band' })
      const box = mute.getBoundingClientRect()
      await expect([Math.round(box.width), Math.round(box.height)]).toEqual([48, 48])
      await expect(rgbOf(getComputedStyle(mute).backgroundColor)[3]).toBe(0)
      await userEvent.click(mute)
      await expect(mute).toHaveAttribute('aria-pressed', 'true')
    }
  },
}

function PanelTiles() {
  const [rest, setRest] = useState('beat')
  const [appearance, setAppearance] = useState('system')
  return (
    <div className="flex w-88 max-w-full flex-col gap-3 rounded-panel bg-panel p-4 text-foreground">
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

/** The contracts' fixture stems (guitar, bass, drums and the mix-minus), as the app loads them. */
export const FixtureStems: Story = {
  render: () => (
    <div className="flex w-85 flex-col bg-panel p-2">
      {FIXTURE_STEMS.map((stem) => (
        <StemRow
          key={stem.id}
          stem={stem.stem}
          name={stem.name}
          rough={stem.rough ? { label: COPY.rough, reason: COPY.roughStem } : undefined}
          muted={false}
          soloed={false}
          gainDb={0}
          onMutedChange={() => undefined}
          onSoloedChange={() => undefined}
          onGainChange={() => undefined}
          labels={LABELS}
        />
      ))}
    </div>
  ),
  globals: BOTH_THEMES,
}

export const Stage: Story = {
  render: () => <Mixer initial={{ bass: { soloed: true }, vocals: { muted: true } }} />,
  globals: { appearance: 'stage', density: 'practice' },
}
export const IncreasedContrast: Story = {
  render: () => <Mixer initial={{ bass: { soloed: true } }} />,
  globals: { ...BOTH_THEMES, contrast: 'more' },
}
