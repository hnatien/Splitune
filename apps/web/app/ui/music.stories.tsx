import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { m } from '@/lib/i18n'
import { AppStory } from '../../.storybook/app.tsx'
import { ChordStrip as PracticeChordStrip } from '../features/practice/chord-strip.tsx'
import { GlanceView } from '../features/practice/glance-view.tsx'
import { PracticeProvider, usePractice } from '../features/practice/practice-context.tsx'
import { SONG_ID, seed, tone } from '../features/practice/practice-story-data.ts'
import { Button } from './button.tsx'
import { ChordChip } from './chord-chip.tsx'
import { ConfidenceLegend, ConfidenceLegendPopover } from './confidence-legend.tsx'
import { COPY, FIXTURE_CHORDS } from './fixtures.ts'

const meta = { title: 'Kit/Chords and confidence' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** The fixture's Am–F–C–G strip: G is low confidence, so it gets the dashed box and "?". */
function ChordStrip({
  current = 1,
  editable = false,
  popover = false,
}: {
  current?: number
  editable?: boolean
  /** The strip's responsive legend: inline from `lg`, a button with a popover below. */
  popover?: boolean
}) {
  const [show, setShow] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const legend = {
    text: COPY.legend,
    labels: { showUncertainty: COPY.showUncertainty, medium: COPY.probably, low: COPY.unsure },
    showUncertainty: show,
    onShowUncertaintyChange: setShow,
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {FIXTURE_CHORDS.map((chord, index) => (
          <ChordChip
            key={chord.id}
            label={chord.label}
            confidence={chord.confidence}
            timing={index < current ? 'past' : index === current ? 'current' : 'upcoming'}
            showUncertainty={show}
            confidenceText={
              chord.confidence === 'low' ? COPY.unsure.toLowerCase() : COPY.probably.toLowerCase()
            }
            selected={selected === chord.id}
            onClick={
              editable ? () => setSelected(selected === chord.id ? null : chord.id) : undefined
            }
          />
        ))}
      </div>
      {popover ? (
        <>
          <ConfidenceLegend {...legend} className="hidden lg:inline-flex" />
          <ConfidenceLegendPopover
            {...legend}
            className="self-start lg:hidden"
            buttonLabel={m['practice.legend_button']()}
          />
        </>
      ) : (
        <ConfidenceLegend {...legend} />
      )}
    </div>
  )
}

export const Strip: Story = { render: () => <ChordStrip /> }

export const Levels: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <ChordChip label="Am" confidence="high" />
      <ChordChip label="F" confidence="medium" confidenceText="probably" />
      <ChordChip label="G7" confidence="low" confidenceText="unsure" />
      <ChordChip label="C" confidence="high" timing="current" />
      <ChordChip label="Em" confidence="low" timing="current" confidenceText="unsure" />
      <ChordChip label="Dm" confidence="medium" selected confidenceText="probably" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'G7, unsure' })).toHaveAttribute(
      'data-confidence',
      'low',
    )
    await expect(canvas.getByRole('button', { name: 'C' })).toHaveAttribute('aria-current', 'true')
  },
}

export const UncertaintyHidden: Story = {
  render: () => <ChordStrip />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: COPY.showUncertainty }))
    // Outlines and "?" go; the lighter ink stays (doc 26 §5).
    const low = canvas.getByRole('button', { name: 'G' })
    await expect(getComputedStyle(low).borderStyle).toBe('solid')
  },
}

export const SelectForEdit: Story = {
  render: () => <ChordStrip editable />,
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByRole('button', { name: /^F/ })
    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
  },
}

export const Hyperlegible: Story = {
  render: () => <ChordStrip />,
  globals: { readingFont: 'hyperlegible' },
}
export const AtTheStand: Story = { render: () => <ChordStrip />, globals: { distance: 'stand' } }
export const Glance: Story = { render: () => <ChordStrip />, globals: { distance: 'floor' } }
export const Dark: Story = { render: () => <ChordStrip />, globals: { appearance: 'dark' } }
export const Stage: Story = { render: () => <ChordStrip />, globals: { appearance: 'stage' } }
export const IncreasedContrast: Story = {
  render: () => <ChordStrip />,
  globals: { contrast: 'more' },
}

const PHONE = { viewport: { value: 'mobile2', isRotated: false } }

/** Below `lg` the inline legend is gone: a button opens the same legend in a popover. */
export const LegendButton: Story = {
  render: () => <ChordStrip popover />,
  globals: { ...PHONE, distance: 'stand' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement.querySelector('[data-slot=confidence-legend]')).not.toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: m['practice.legend_button']() }))
    // The popover's contents load on first open.
    const popup = await within(canvasElement.ownerDocument.body).findByRole('dialog')
    // Popups fade in (26 §10).
    await waitFor(async () => expect(await within(popup).findByText(COPY.legend)).toBeVisible())
    await userEvent.click(within(popup).getByRole('switch', { name: COPY.showUncertainty }))
    await expect(within(popup).queryByText(COPY.probably)).toBeNull()
  },
}
export const LegendButtonDark: Story = {
  ...LegendButton,
  globals: { ...PHONE, appearance: 'dark' },
}
export const LegendButtonStage: Story = {
  ...LegendButton,
  globals: { ...PHONE, appearance: 'stage' },
}

/** Seeks into the song's first chord (the fixture opens with half a second of silence). */
function SeekIntoSong() {
  const { send } = usePractice()
  return (
    <Button size="sm" onClick={() => send({ type: 'SEEK', seconds: 1 })}>
      Seek into the song
    </Button>
  )
}

/** The real strip on the fixture song, on its first chord. */
const practiceStrip = () => (
  <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(['beats', 'chords'])}>
    <PracticeProvider songId={SONG_ID} search={{}} fetchAudio={tone}>
      <div data-density="practice" className="max-w-4xl">
        <SeekIntoSong />
        <PracticeChordStrip legend={false} />
      </div>
    </PracticeProvider>
  </AppStory>
)

/** The enlarged current chip, its focus ring included, stays inside the list and the strip. */
const scaledChipFits: NonNullable<Story['play']> = async ({ canvasElement }) => {
  const list = await within(canvasElement).findByRole('list', { name: 'Chords' })
  const strip = canvasElement.querySelector('[data-slot=chord-strip]')
  const seek = within(canvasElement).getByRole('button', { name: 'Seek into the song' })
  const chip = await waitFor(
    async () => {
      await userEvent.click(seek)
      const found = list.querySelector<HTMLElement>('[aria-current=true]')
      if (!found) throw new Error('no current chord yet')
      return found
    },
    { timeout: 20_000 },
  )
  // The scale is the ratio of the two reading sizes at this distance.
  const size = (token: string) => {
    const probe = document.createElement('span')
    probe.style.fontSize = `var(${token})`
    document.body.append(probe)
    const px = Number.parseFloat(getComputedStyle(probe).fontSize)
    probe.remove()
    return px
  }
  const ratio = size('--read-chord-current') / size('--read-chord')
  await waitFor(() =>
    expect(chip.getBoundingClientRect().width / chip.offsetWidth).toBeCloseTo(ratio, 1),
  )
  const ring = 4
  const box = chip.getBoundingClientRect()
  for (const clip of [list, strip]) {
    const edge = clip?.getBoundingClientRect()
    await expect(box.left - ring).toBeGreaterThanOrEqual(edge?.left ?? Number.NaN)
    await expect(box.top - ring).toBeGreaterThanOrEqual(edge?.top ?? Number.NaN)
    await expect(box.bottom + ring).toBeLessThanOrEqual(edge?.bottom ?? Number.NaN)
  }
}

export const CurrentChipDesk: Story = {
  render: practiceStrip,
  parameters: { layout: 'fullscreen' },
  globals: { distance: 'desk' },
  play: scaledChipFits,
}
export const CurrentChipStand: Story = { ...CurrentChipDesk, globals: { distance: 'stand' } }
export const CurrentChipFloor: Story = { ...CurrentChipDesk, globals: { distance: 'floor' } }
export const CurrentChipDark: Story = { ...CurrentChipDesk, globals: { appearance: 'dark' } }
export const CurrentChipStage: Story = { ...CurrentChipDesk, globals: { appearance: 'stage' } }

/** The glance view's way to a loop: one tap loops the current bar. */
export const GlanceLoopThisBar: Story = {
  render: () => (
    <AppStory path={`/songs/${SONG_ID}/practice`} seed={seed(['beats', 'chords'])}>
      <PracticeProvider songId={SONG_ID} search={{}} fetchAudio={tone}>
        <div data-density="practice" className="flex h-[40rem] flex-col">
          <GlanceView />
        </div>
      </PracticeProvider>
    </AppStory>
  ),
  globals: { distance: 'floor' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('region', { name: 'Current chord' })).toBeVisible()
    await userEvent.click(
      await canvas.findByRole('button', { name: m['practice.loop_this_bar']() }),
    )
    // A one-bar loop: the same bar twice, and the button makes way for the loop.
    await expect(await canvas.findByText(/Bars (\d+)–\1/)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: m['practice.loop_this_bar']() })).toBeNull()
  },
}
export const GlanceLoopThisBarDark: Story = {
  ...GlanceLoopThisBar,
  globals: { distance: 'floor', appearance: 'dark' },
}
export const GlanceLoopThisBarStage: Story = {
  ...GlanceLoopThisBar,
  globals: { distance: 'floor', appearance: 'stage' },
}
