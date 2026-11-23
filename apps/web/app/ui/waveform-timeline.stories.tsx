import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import { contrastRatio, rgbOf, sameColour, tokenColour } from './fixtures.ts'
import { BOTH_THEMES, expectTargets, themeFrames } from './story-kit.tsx'
import {
  type TimelineBar,
  type TimelineLane,
  type TimelineSection,
  WaveformTimeline,
} from './waveform-timeline.tsx'

// Doc 26 §12.2, s47 direction §3, §6: the song map. Section chips over the waveform (a chip loops
// its section), waveform bars (unplayed, the played part in the stronger tone, the loop's bars in
// the ink), the ink-edged loop band with ≥ 44 px handles (easing in and out), the unsure hatch
// above, the 2 px ink playhead, the ruler when there are no sections (or seconds before the beat
// grid), and the compact form (phone landscape).
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
  loopStart: 'Loop start, bar 3',
  loopEnd: 'Loop end, bar 4',
  sections: 'Sections',
}
const SECTIONS: TimelineSection[] = [
  { start: 0, end: 0.5, label: 'Intro' },
  { start: 0.5, end: 5.3, label: 'Verse' },
  { start: 5.3, end: 10.1, label: 'Chorus' },
  { start: 10.1, end: 15, label: 'Verse 2' },
  { start: 15, end: DURATION, label: 'Outro' },
]
const VIEWPORTS = {
  viewport: {
    options: {
      phone: { name: 'Phone 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
    },
  },
}
const PHONE = { viewport: { value: 'phone', isRotated: false }, pointer: 'coarse' } as const

function Timeline(props: Partial<React.ComponentProps<typeof WaveformTimeline>>) {
  const [loop, setLoop] = useState(props.loop ?? null)
  return (
    <WaveformTimeline
      lanes={LANES}
      duration={DURATION}
      bars={BARS}
      position={() => 6.1}
      onSeek={fn()}
      labels={LABELS}
      {...props}
      loop={loop}
      onLoopSection={(section) => setLoop({ start: section.start, end: section.end })}
      onNudgeLoop={(edge, direction) =>
        setLoop((current) => current && { ...current, [edge]: current[edge] + direction * 0.15 })
      }
    />
  )
}

export const Default: Story = { render: () => <Timeline /> }

/** The song map as the practice screen sets it: section chips, the loop on the chorus. */
export const SongMap: Story = {
  render: () => <Timeline sections={SECTIONS} loop={{ start: 5.3, end: 10.1 }} />,
  globals: BOTH_THEMES,
}

/** A chip loops its section; the looped section's chip carries a 2 px ink line and
 * aria-pressed. Chips are 24 px tall on fine pointers. */
export const SectionChips: Story = {
  render: () => <Timeline sections={SECTIONS} />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const group = canvas.getByRole('group', { name: 'Sections' })
      const chips = within(group).getAllByRole('button')
      await expect(chips.map((chip) => chip.textContent)).toEqual(
        SECTIONS.map((section) => section.label),
      )
      for (const chip of chips) {
        await expect(Math.round(chip.getBoundingClientRect().height)).toBe(24)
      }
      const verse = canvas.getByRole('button', { name: 'Verse' })
      await expect(verse).toHaveAttribute('aria-pressed', 'false')
      await userEvent.click(verse)
      await userEvent.unhover(verse)
      await expect(verse).toHaveAttribute('aria-pressed', 'true')
      // The line: 2 px of ink under the chip's label, ≥ 3:1 on the page, no fill on the chip.
      const line = getComputedStyle(verse, '::after')
      await expect(line.height).toBe('2px')
      const ink = tokenColour('--selected', frame)
      await expect(sameColour(line.backgroundColor, ink)).toBe(true)
      await expect(contrastRatio(ink, tokenColour('--background', frame))).toBeGreaterThanOrEqual(3)
      await waitFor(() => expect(rgbOf(getComputedStyle(verse).backgroundColor)[3]).toBe(0))
      // The loop is on the verse now: its handles appear at the section's ends.
      await expect(await canvas.findByRole('button', { name: 'Loop start, bar 3' })).toBeVisible()
      // Without sections the map has its ruler instead.
      await expect(frame.querySelector('[data-slot=ruler]')).toBeNull()
    }
  },
}

/** Coarse pointers make every chip a 44 px target; nothing leaves the map at 375 px. */
export const SectionChipsOnAPhone: Story = {
  render: () => <Timeline sections={SECTIONS} loop={{ start: 5.3, end: 10.1 }} />,
  parameters: { ...VIEWPORTS, layout: 'fullscreen' },
  globals: { ...PHONE, appearance: 'light' },
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector<HTMLElement>('[data-slot=waveform-timeline]')
    if (!map) throw new Error('no map')
    const chips = within(map).getAllByRole('button', { name: /^(Intro|Verse|Chorus|Outro)/ })
    for (const chip of chips) {
      await expect(Math.round(chip.getBoundingClientRect().height)).toBe(44)
      await expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(375 + 0.5)
    }
    await expect(map.scrollWidth).toBeLessThanOrEqual(map.clientWidth)
    await expectTargets(within(map).getAllByRole('button', { name: /^Loop / }), 44)
  },
}
export const SectionChipsOnAPhoneDark: Story = {
  ...SectionChipsOnAPhone,
  globals: { ...PHONE, appearance: 'dark' },
}

/** Sections the caller can't loop are plain labels, not controls. */
export const SectionLabels: Story = {
  render: () => (
    <WaveformTimeline
      lanes={LANES}
      duration={DURATION}
      bars={BARS}
      sections={SECTIONS}
      position={() => 6.1}
      onSeek={fn()}
      labels={LABELS}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Verse' })).toBeNull()
    await expect(within(canvasElement).getByText('Verse')).toBeVisible()
  },
}

/** The playhead is a 2 px ink line; the part already played is drawn in the stronger tone. */
export const Playhead: Story = {
  render: () => <Timeline sections={SECTIONS} />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const line = frame.querySelector<HTMLElement>('[data-slot=now-line]') as HTMLElement
      await expect(line.getBoundingClientRect().width).toBe(2)
      const ink = tokenColour('--playhead', frame)
      await expect(sameColour(getComputedStyle(line).backgroundColor, ink)).toBe(true)
      await expect(contrastRatio(ink, tokenColour('--background', frame))).toBeGreaterThanOrEqual(3)
      // The played tone is further from the page than the unplayed one.
      const page = tokenColour('--background', frame)
      await expect(contrastRatio(tokenColour('--waveform-played', frame), page)).toBeGreaterThan(
        contrastRatio(tokenColour('--waveform-peak', frame), page),
      )
      // The played canvas is clipped to the playhead (6.1 s of 20.5 s).
      const played = frame.querySelector<HTMLElement>('[data-slot=played]') as HTMLElement
      await waitFor(() => expect(played.style.clipPath).toMatch(/^inset\(0px \d/))
    }
  },
}

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

const scrubSeek = fn()

export const Scrub: Story = {
  render: () => <Timeline onSeek={scrubSeek} />,
  play: async ({ canvasElement }) => {
    scrubSeek.mockClear()
    const map = canvasElement.querySelector<HTMLElement>('[data-slot="waveform-timeline"] > div')
    if (!map) throw new Error('no map')
    const box = map.getBoundingClientRect()
    const at = (fraction: number) => ({
      clientX: box.left + box.width * fraction,
      clientY: box.top + box.height / 2,
    })
    // Pressing seeks, and dragging keeps seeking until release.
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: map, coords: at(0.25) },
      { target: map, coords: at(0.5) },
      { target: map, coords: at(0.75) },
      { keys: '[/MouseLeft]', target: map, coords: at(0.75) },
    ])
    await expect(scrubSeek).toHaveBeenNthCalledWith(1, expect.closeTo(DURATION * 0.25, 1), false)
    await expect(scrubSeek).toHaveBeenLastCalledWith(expect.closeTo(DURATION * 0.75, 1), true)
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

export const Daylight: Story = {
  render: () => <Timeline loop={{ start: 5.3, end: 10.1 }} />,
  globals: { appearance: 'light' },
}

/** The loop band's edges are the ink, ≥ 3:1 on the page and on the band's own wash. */
export const LoopEdges: Story = {
  render: () => <Timeline loop={{ start: 5.3, end: 10.1 }} />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const edge = tokenColour('--loop-edge', frame)
      await expect(sameColour(edge, tokenColour('--selected', frame))).toBe(true)
      await expect(contrastRatio(edge, tokenColour('--background', frame))).toBeGreaterThanOrEqual(
        3,
      )
      await expect(contrastRatio(edge, tokenColour('--loop-fill', frame))).toBeGreaterThanOrEqual(3)
      const canvas = frame.querySelector('canvas') as HTMLCanvasElement
      // The 2 px edge at the loop's start, just above the bars: some pixel across it is the ink
      // (the ones it only partly covers are antialiased).
      const context = canvas.getContext('2d') as CanvasRenderingContext2D
      const ink = rgbOf(edge).slice(0, 3).join()
      await waitFor(() => {
        // Read once the map has drawn at its own size (a fresh canvas is 300 × 150).
        const at = (5.3 / DURATION) * canvas.width
        const y = Math.round((canvas.height * 6) / 40)
        const row = context.getImageData(Math.floor(at) - 1, y, 6, 1).data
        const pixels = Array.from({ length: 6 }, (_, i) => [...row.slice(i * 4, i * 4 + 3)].join())
        expect(pixels).toContain(ink)
      })
    }
  },
}

export const Stage: Story = {
  render: () => <Timeline loop={{ start: 5.3, end: 10.1 }} />,
  globals: { appearance: 'stage' },
}

const LOOP = { start: 5.3, end: 10.1 }

/** A loop that comes and goes, to watch the band ease. */
function LoopSwitch() {
  const [on, setOn] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" aria-pressed={on} onClick={() => setOn(!on)}>
        Toggle loop
      </Button>
      <WaveformTimeline
        lanes={LANES}
        duration={DURATION}
        bars={BARS}
        loop={on ? LOOP : null}
        position={() => 6.1}
        onSeek={fn()}
        labels={LABELS}
      />
    </div>
  )
}

/** The loop edge's opacity just above the waveform (the canvas is 40 px: the band starts at 5,
 * the bars at 7), where only the band and its edges reach. */
function edgeAlpha(canvasElement: HTMLElement) {
  const canvas = canvasElement.querySelector('canvas')
  const context = canvas?.getContext('2d')
  if (!canvas || !context) throw new Error('no timeline canvas')
  const x = Math.round((LOOP.start / DURATION) * canvas.width) + 1
  return context.getImageData(x, Math.round((canvas.height * 6) / 40), 1, 1).data[3] ?? 0
}

const toggle = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  // The canvas draws once it has measured its width (a fresh canvas is 300 × 150).
  await waitFor(() =>
    expect(canvasElement.querySelector('canvas')?.height).toBe(Math.round(40 * devicePixelRatio)),
  )
  await expect(edgeAlpha(canvasElement)).toBe(0)
  await userEvent.click(canvas.getByRole('button', { name: 'Toggle loop' }))
}

/** A new loop fades in over --duration-base: shortly after the press the edge is still partial. */
export const LoopEasesIn: Story = {
  render: () => <LoopSwitch />,
  play: async ({ canvasElement }) => {
    await toggle(canvasElement)
    const early = edgeAlpha(canvasElement)
    await waitFor(() => expect(edgeAlpha(canvasElement)).toBeGreaterThan(0))
    await waitFor(() => expect(edgeAlpha(canvasElement)).toBe(255))
    await expect(early).toBeLessThan(255)
  },
}

/** Reduced motion draws the final band at once: no partial opacity is ever painted. */
export const LoopJumpsWhenMotionIsReduced: Story = {
  render: () => <LoopSwitch />,
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    await toggle(canvasElement)
    await waitFor(() => expect(edgeAlpha(canvasElement)).toBeGreaterThan(0))
    await expect(edgeAlpha(canvasElement)).toBe(255)
  },
}
