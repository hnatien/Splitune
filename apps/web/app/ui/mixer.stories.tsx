import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { COPY, FIXTURE_STEMS } from './fixtures.ts'
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
    <div className="flex max-w-3xl flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <MixPresetGroup
        label="Mix"
        value={preset}
        onValueChange={setPreset}
        options={[
          { value: 'part-loud', label: 'Your part loud' },
          { value: 'minus-one', label: 'Minus-one' },
          { value: 'original', label: 'Original' },
        ]}
      />
      <div className="flex flex-col divide-y divide-border">
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

export const Default: Story = { render: () => <Mixer /> }
export const Loading: Story = { render: () => <Mixer loading /> }

export const MuteAndSolo: Story = {
  render: () => <Mixer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mute = canvas.getByRole('button', { name: 'Mute Drums' })
    await userEvent.click(mute)
    await expect(mute).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: /Your part loud/ })).toHaveAttribute(
      'aria-pressed',
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
    await expect(canvas.getByRole('textbox', { name: 'Volume Bass' })).toHaveValue('-7')
  },
}

export const Dark: Story = { render: () => <Mixer />, globals: { appearance: 'dark' } }
export const Stage: Story = {
  render: () => <Mixer />,
  globals: { appearance: 'stage', density: 'practice' },
}
export const IncreasedContrast: Story = { render: () => <Mixer />, globals: { contrast: 'more' } }
