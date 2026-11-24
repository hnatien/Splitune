import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { m } from '@/lib/i18n'
import { AppStory } from '../../.storybook/app.tsx'
import { ChordStrip as PracticeChordStrip } from '../features/practice/chord-strip.tsx'
import { GlanceView } from '../features/practice/glance-view.tsx'
import { PracticeProvider, usePractice } from '../features/practice/practice-context.tsx'
import { SONG_ID, seed, tone } from '../features/practice/practice-story-data.ts'
import { BeatPulse } from './beat-pulse.tsx'
import { Button } from './button.tsx'
import { ChordChip, ChordSymbol, chordText } from './chord-chip.tsx'
import { ConfidenceLegend, ConfidenceLegendPopover } from './confidence-legend.tsx'
import {
  COPY,
  contrastRatio,
  FIXTURE_CHORDS,
  inkEdgeOf,
  rgbOf,
  sameColour,
  tokenColour,
} from './fixtures.ts'
import { BOTH_THEMES, expectTargets, StateGrid, themeFrames } from './story-kit.tsx'

// Doc 26 §5, §12.2, s47 direction §4: chord chips and the confidence key. Every chord name and
// digit stays ink; Probably is a dotted box, Unsure a dashed box and a "?" in --conf-low-edge (the
// only place the unsure hue appears), Edited a 2 px underline; hidden marks leave plain ink.
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
  /** The practice screen's legend: a chip that opens it in a popover. */
  popover?: boolean
}) {
  const [show, setShow] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const legend = {
    text: COPY.legend,
    labels: {
      showUncertainty: COPY.showUncertainty,
      high: 'Sure',
      medium: COPY.probably,
      low: COPY.unsure,
      edited: 'Edited by you',
    },
    frequency: 'About 1 in 8 notes in this song are marked unsure',
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
        <ConfidenceLegendPopover
          {...legend}
          className="self-start"
          shortcut="U"
          buttonLabel={m['practice.legend_short']({ count: '6' })}
        />
      ) : (
        <ConfidenceLegend {...legend} />
      )}
    </div>
  )
}

export const Strip: Story = { render: () => <ChordStrip />, globals: BOTH_THEMES }

const LEVELS = () => (
  <StateGrid
    states={[
      ['Sure', <ChordChip key="sure" label="Am" confidence="high" />],
      ['Probably', <ChordChip key="p" label="F" confidence="medium" confidenceText="probably" />],
      ['Unsure', <ChordChip key="u" label="G7" confidence="low" confidenceText="unsure" />],
      ['Edited', <ChordChip key="e" label="Dm" confidence="high" edited editedText="edited" />],
      ['Current', <ChordChip key="c" label="C" confidence="high" timing="current" />],
      [
        'Current, unsure',
        <ChordChip key="cu" label="Em" confidence="low" timing="current" confidenceText="unsure" />,
      ],
      [
        'Open in the editor',
        <ChordChip key="s" label="Bb" confidence="medium" selected confidenceText="probably" />,
      ],
      [
        'Then (pill)',
        <ChordChip key="t" label="E7" confidence="low" variant="pill" confidenceText="unsure" />,
      ],
    ]}
  />
)

/** Each level by its shape: the name is ink at every level; only the box and "?" carry a hue. */
export const Levels: Story = {
  render: LEVELS,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const ink = tokenColour('--ink', frame)
      const paper = tokenColour('--paper', frame)
      const chips = canvas.getAllByRole('button')
      for (const chip of chips) {
        const name = chip.querySelector('[data-slot=chord-name]') as HTMLElement
        await expect(sameColour(getComputedStyle(name).color, ink)).toBe(true)
      }
      // Unsure: a 1.5 px dashed box and a "?" in --conf-low-edge (≥ 4.5:1 on the paper).
      const unsure = canvas.getByRole('button', { name: 'G7, unsure' })
      const lowEdge = tokenColour('--conf-low-edge', frame)
      const box = getComputedStyle(unsure)
      // A 1.5 px border, which the browser snaps to whole device pixels (1 px at 1×).
      await expect(box.borderTopStyle).toBe('dashed')
      await expect(Number.parseFloat(box.borderTopWidth)).toBeGreaterThanOrEqual(1)
      await expect(sameColour(box.borderTopColor, lowEdge)).toBe(true)
      const glyph = unsure.querySelector('[data-slot=unsure-glyph]') as HTMLElement
      await expect(glyph).toHaveTextContent('?')
      await expect(sameColour(getComputedStyle(glyph).color, lowEdge)).toBe(true)
      await expect(contrastRatio(lowEdge, paper)).toBeGreaterThanOrEqual(4.5)
      // Probably: a dotted box in --conf-medium-edge, no glyph.
      const probably = canvas.getByRole('button', { name: 'F, probably' })
      await expect(getComputedStyle(probably).borderTopStyle).toBe('dotted')
      await expect(
        sameColour(
          getComputedStyle(probably).borderTopColor,
          tokenColour('--conf-medium-edge', frame),
        ),
      ).toBe(true)
      await expect(probably.querySelector('[data-slot=unsure-glyph]')).toBeNull()
      // Edited: a 2 px underline in --edited under an ink name.
      const edited = canvas.getByRole('button', { name: 'Dm, edited' })
      const mark = getComputedStyle(edited.querySelector('[data-slot=chord-name]') as Element)
      await expect(mark.textDecorationLine).toBe('underline')
      await expect(mark.textDecorationThickness).toBe('2px')
      await expect(sameColour(mark.textDecorationColor, tokenColour('--edited', frame))).toBe(true)
      // Current: the wash with a 2 px ink line under it, never the wash alone.
      const current = canvas.getByRole('button', { name: 'C' })
      await expect(current).toHaveAttribute('aria-current', 'true')
      const line = getComputedStyle(current, '::after')
      await expect(line.height).toBe('2px')
      await expect(sameColour(line.backgroundColor, tokenColour('--selected', frame))).toBe(true)
      // Open in the editor: the 1.5 px ink edge, ≥ 3:1.
      const selected = canvas.getByRole('button', { name: 'B♭, probably' })
      await expect(selected).toHaveAttribute('aria-pressed', 'true')
      await expect(inkEdgeOf(selected).width).toBe(1.5)
      await expect(inkEdgeOf(selected).contrast).toBeGreaterThanOrEqual(3)
      // Every chip is a 48 px target.
      await expectTargets(chips, 48)
    }
  },
}

/** Chord symbols as charts print them: ♭/♯ glyphs, the quality raised, the slash bass smaller. */
export const Symbols: Story = {
  render: () => (
    <div className="flex flex-wrap items-baseline gap-8 bg-paper p-6 font-reading text-read-chord-current text-ink">
      {['Ebmaj7', 'Abm7', 'Bb7', 'F#m7b5', 'C/E', 'Am7/G', 'Db', 'N.C.'].map((name) => (
        <ChordSymbol key={name} name={name} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('maj7').closest('[data-slot=chord-symbol]')).toHaveTextContent(
      'E♭maj7',
    )
    await expect(chordText('F#m7b5')).toBe('F♯m7♭5')
    await expect(chordText('Am7/Gb')).toBe('Am7/G♭')
    await expect(canvas.getByText('N.C.')).toBeVisible()
  },
}

/** "Show uncertainty" off: the boxes and the "?" go, the name stays plain ink. */
export const UncertaintyHidden: Story = {
  render: () => <ChordStrip />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: COPY.showUncertainty }))
    const low = canvas.getByRole('button', { name: 'G' })
    await expect(low.querySelector('[data-slot=unsure-glyph]')).toBeNull()
    // The box fades out over --duration-base.
    await waitFor(() => expect(rgbOf(getComputedStyle(low).borderTopColor)[3]).toBe(0))
    await expect(
      sameColour(
        getComputedStyle(low.querySelector('[data-slot=chord-name]') as Element).color,
        tokenColour('--ink', low),
      ),
    ).toBe(true)
    // The key goes with the marks.
    await expect(canvas.queryByText(COPY.probably)).toBeNull()
  },
}

export const SelectForEdit: Story = {
  render: () => <ChordStrip editable />,
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByRole('button', { name: /^F/ })
    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(inkEdgeOf(chip).width).toBe(1.5))
  },
}

/** The key draws each mark as the notation does: ink digits, the hue only on the unsure box. */
export const Legend: Story = {
  render: () => <ChordStrip />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const ink = tokenColour('--ink', frame)
      const sample = (slot: string) => frame.querySelector(`[data-slot=${slot}]`) as HTMLElement
      for (const slot of ['legend-sure', 'legend-probably', 'legend-unsure', 'legend-edited']) {
        await expect(sameColour(getComputedStyle(sample(slot)).color, ink)).toBe(true)
        await expect(
          Number.parseFloat(getComputedStyle(sample(slot)).fontSize),
        ).toBeGreaterThanOrEqual(11)
      }
      const unsure = getComputedStyle(sample('legend-unsure'))
      await expect(unsure.borderTopStyle).toBe('dashed')
      await expect(sameColour(unsure.borderTopColor, tokenColour('--conf-low-edge', frame))).toBe(
        true,
      )
      const glyph = sample('legend-unsure').lastElementChild as HTMLElement
      await expect(glyph).toHaveTextContent('?')
      await expect(
        sameColour(getComputedStyle(glyph).color, tokenColour('--conf-low-edge', frame)),
      ).toBe(true)
      await expect(getComputedStyle(sample('legend-probably')).borderTopStyle).toBe('dotted')
      const edited = getComputedStyle(sample('legend-edited'))
      await expect(edited.textDecorationThickness).toBe('2px')
      await expect(sameColour(edited.textDecorationColor, tokenColour('--edited', frame))).toBe(
        true,
      )
      await expect(
        within(frame).getByText('About 1 in 8 notes in this song are marked unsure'),
      ).toBeVisible()
    }
  },
}

export const Hyperlegible: Story = {
  render: () => <ChordStrip />,
  globals: { readingFont: 'hyperlegible' },
}
export const AtTheStand: Story = { render: () => <ChordStrip />, globals: { distance: 'stand' } }
export const Glance: Story = { render: () => <ChordStrip />, globals: { distance: 'floor' } }
export const Dark: Story = { render: () => <ChordStrip />, globals: { appearance: 'dark' } }
export const Light: Story = { render: () => <ChordStrip />, globals: { appearance: 'light' } }
export const Stage: Story = { render: () => <ChordStrip />, globals: { appearance: 'stage' } }
export const IncreasedContrast: Story = {
  render: () => <ChordStrip />,
  globals: { ...BOTH_THEMES, contrast: 'more' },
}

const VIEWPORTS = {
  viewport: {
    options: {
      phone: { name: 'Phone 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
    },
  },
}
const PHONE = { viewport: { value: 'phone', isRotated: false }, pointer: 'coarse' } as const

/** The practice screen's "[?] 6 unsure" chip opens the key and the "Show uncertainty" switch in a
 * popover; on a phone the dashed "?" box alone stays, a 48 px target, and the key cap goes. */
export const LegendButton: Story = {
  render: () => <ChordStrip popover />,
  parameters: VIEWPORTS,
  globals: { ...PHONE, distance: 'stand' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement.querySelector('[data-slot=confidence-legend]')).toBeNull()
    const chip = canvas.getByRole('button', { name: m['practice.legend_short']({ count: '6' }) })
    await expectTargets([chip], 48)
    await expect(chip).toHaveAttribute('aria-keyshortcuts', 'U')
    await expect(chip.querySelector('kbd')).not.toBeVisible()
    const mark = chip.querySelector('[data-slot=legend-chip-mark]') as HTMLElement
    await expect(getComputedStyle(mark).borderTopStyle).toBe('dashed')
    await userEvent.click(chip)
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

/** On fine pointers the chip prints its words and its key cap; open, it has the ink edge. */
export const LegendButtonDesk: Story = {
  render: () => <ChordStrip popover />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    const [frame] = themeFrames(canvasElement)
    const chip = within(frame as HTMLElement).getByRole('button', {
      name: m['practice.legend_short']({ count: '6' }),
    })
    await expect(within(chip).getByText('U')).toBeVisible()
    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(inkEdgeOf(chip.firstElementChild as HTMLElement).width).toBe(1.5))
  },
}

function Pulse({ current }: { current: number }) {
  return <BeatPulse beats={4} current={current} size="md" label={`Beat ${current + 1} of 4`} />
}

/** The beat pulse: the downbeat square, the current beat the ink with a ring, played beats
 * filled, the rest outlined; "now" differs from "played" by its ring, not only its tone. */
export const Beats: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <StateGrid
      states={[
        ['Before the first beat', <Pulse key="-1" current={-1} />],
        ['Beat 1', <Pulse key="0" current={0} />],
        ['Beat 3', <Pulse key="2" current={2} />],
        ['3/4, beat 2', <BeatPulse key="34" beats={3} current={1} label="Beat 2 of 3" />],
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const pulse = within(frame).getByRole('img', { name: 'Beat 3 of 4' })
      const dots = [...pulse.children] as HTMLElement[]
      await expect(dots.map((dot) => dot.getAttribute('data-beat'))).toEqual([
        'done',
        'done',
        'now',
        'next',
      ])
      await expect(getComputedStyle(dots[0] as Element).borderTopLeftRadius).not.toBe(
        getComputedStyle(dots[1] as Element).borderTopLeftRadius,
      )
      const now = getComputedStyle(dots[2] as Element)
      await expect(now.outlineStyle).toBe('solid')
      await expect(getComputedStyle(dots[1] as Element).outlineStyle).toBe('none')
      await expect(
        contrastRatio(now.backgroundColor, tokenColour('--background', frame)),
      ).toBeGreaterThanOrEqual(3)
    }
  },
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
        <PracticeChordStrip />
      </div>
    </PracticeProvider>
  </AppStory>
)

/** The current chord, set at the larger reading size, stays inside the list and the strip with
 * its focus ring. */
const currentChipFits: NonNullable<Story['play']> = async ({ canvasElement }) => {
  // The list appears once the chord layer has loaded.
  const list = await within(canvasElement).findByRole(
    'list',
    { name: 'Chords' },
    { timeout: 10_000 },
  )
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
  const probe = document.createElement('span')
  probe.style.fontSize = 'var(--read-chord-current)'
  document.body.append(probe)
  const current = Number.parseFloat(getComputedStyle(probe).fontSize)
  probe.remove()
  await expect(Number.parseFloat(getComputedStyle(chip).fontSize)).toBeCloseTo(current, 0)
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
  play: currentChipFits,
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
