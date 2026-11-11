import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Popover } from './popover.tsx'
import { SpeedControl } from './speed-control.tsx'
import { LadderChip, LadderIcon, SpeedLadder } from './speed-ladder.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  DAYLIGHT,
  expectTargets,
  StateGrid,
  themeFrames,
} from './story-kit.tsx'

const RUNGS = [70, 75, 80, 85, 90, 95, 100]
const LONG = Array.from({ length: 61 }, (_, i) => 50 + i)

const meta = {
  title: 'Kit/SpeedLadder',
  component: SpeedLadder,
  args: { rungs: RUNGS, current: 1, label: '70 percent done, 75 percent now, 80 percent next' },
  decorators: [
    (Story) => (
      <div className="w-81 rounded-3xl border border-border bg-card p-3.5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpeedLadder>
export default meta
type Story = StoryObj<typeof meta>

const rung = (frame: HTMLElement, text: string) =>
  [...frame.querySelectorAll<HTMLElement>('[data-slot=speed-ladder] > div')].find(
    (node) => node.textContent === text,
  ) as HTMLElement

/** Doc 26 §12.2 `.ladder` (Main.dc.html): 70 done, 75 current, the rest upcoming, rising to the
 * goal. Done has the amber fill and a 1 px --signal edge, current the soft wash and a 2 px ring. */
export const LadderClimbing: Story = {
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const ladder = within(frame).getByRole('img', {
        name: '70 percent done, 75 percent now, 80 percent next',
      })
      await expect(Math.round(ladder.getBoundingClientRect().height)).toBe(70)
      await expect(rung(frame, '70')).toHaveAttribute('data-state', 'done')
      await expect(rung(frame, '75')).toHaveAttribute('data-state', 'current')
      await expect(rung(frame, '80')).toHaveAttribute('data-state', 'upcoming')
      // The goal fills the box; every rung before it is shorter than the next.
      const heights = RUNGS.map((pct) => rung(frame, String(pct)).getBoundingClientRect().height)
      await expect(Math.round(heights.at(-1) ?? 0)).toBe(70)
      await expect(heights.every((h, i) => i === 0 || h > (heights[i - 1] ?? 0))).toBe(true)
      // Labels: mono, 11 px, never smaller (V10).
      const style = getComputedStyle(rung(frame, '80'))
      await expect(style.fontSize).toBe('11px')
      await expect(style.fontFamily).toMatch(/^"?JetBrains Mono/)
      // Done differs from upcoming by its edge as well as its fill (V16): an inset ring.
      await expect(getComputedStyle(rung(frame, '70')).boxShadow).not.toBe('none')
      await expect(getComputedStyle(rung(frame, '80')).boxShadow).toBe('none')
    }
  },
}

/** Every place on the ladder, from the first rung to the goal. */
export const EachRung: Story = {
  globals: BOTH_THEMES,
  decorators: [],
  render: () => (
    <StateGrid
      states={RUNGS.map((pct, current) => [
        `At ${pct} %`,
        <div key={pct} className="w-81 rounded-3xl border border-border bg-card p-3.5">
          <SpeedLadder rungs={RUNGS} current={current} label={`Now at ${pct} percent`} />
        </div>,
      ])}
    />
  ),
}

export const AtStart: Story = {
  args: { current: 0, label: '70 percent now, 75 percent next' },
  globals: BOTH_THEMES,
}

export const AtGoal: Story = {
  args: { current: 6, label: '70 to 95 percent done, at the goal of 100 percent' },
  globals: BOTH_THEMES,
}

/** Start 50 %, Goal 110 %, Step 1 %: 61 rungs show as the nine around the current one, with one
 * done rung kept in view; labels stay inside their rungs. */
export const LongValues: Story = {
  args: {
    rungs: LONG,
    current: 28,
    label: '50 to 77 percent done, 78 percent now, 79 percent next',
  },
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const shown = [...frame.querySelectorAll<HTMLElement>('[data-slot=speed-ladder] > div')]
      await expect(shown.map((node) => node.textContent)).toEqual([
        '77',
        '78',
        '79',
        '80',
        '81',
        '82',
        '83',
        '84',
        '85',
      ])
      for (const node of shown) await expect(node.scrollWidth).toBeLessThanOrEqual(node.clientWidth)
    }
  },
}

/** The last rungs of a long ladder: the window stops at the goal. */
export const LongValuesAtGoal: Story = {
  args: { rungs: LONG, current: 60, label: '50 to 109 percent done, at the goal of 110 percent' },
  globals: BOTH_THEMES,
}

export const Daylight: Story = { globals: DAYLIGHT }
export const IncreasedContrast: Story = { globals: BOTH_THEMES_MORE_CONTRAST }

/** The parameter chips (`.chip`): a 30 px pill in a 48 px box in practice density (26 §8). */
export const Chips: Story = {
  globals: { ...BOTH_THEMES, density: 'practice' },
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <LadderIcon aria-hidden strokeWidth={1.8} className="size-5 text-primary-ink" />
        <span className="text-md font-semibold">Speed ladder</span>
      </div>
      <div className="flex flex-wrap gap-x-1.5">
        {['Start 70 %', 'Goal 100 %', 'Step 5 %', '3 clean passes', 'More'].map((chip) => (
          <Popover key={chip}>
            <LadderChip>{chip}</LadderChip>
          </Popover>
        ))}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const chips = within(frame).getAllByRole('button')
      await expect(chips).toHaveLength(5)
      for (const chip of chips) {
        await expect(Math.round(chip.getBoundingClientRect().height)).toBe(48)
        const face = chip.firstElementChild as HTMLElement
        await expect(Math.round(face.getBoundingClientRect().height)).toBe(30)
      }
    }
  },
}

/** The dock's speed readout with the ladder on (27 §3.7.1, §5.3): "72 BPM · → 100", the goal in
 * the readout's name; −/+ stay 64 px. */
export const SpeedReadoutWithGoal: Story = {
  globals: { ...BOTH_THEMES, density: 'practice' },
  decorators: [],
  render: () => (
    <SpeedControl
      value={75}
      onValueChange={() => undefined}
      bpm={96}
      goal={{ text: '→ 100', label: 'ladder goal 100 %' }}
      inlinePresets={false}
      labels={{
        speed: 'Speed',
        decrease: 'Slower by 5 %',
        increase: 'Faster by 5 %',
        presets: 'Speed presets',
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const canvas = within(frame)
      const readout = canvas.getByRole('button', {
        name: /^Speed: 75\s% · 72\sBPM · → 100, ladder goal 100\s%$/,
      })
      await expect(readout).toHaveTextContent(/72\sBPM · → 100$/)
      await expectTargets(
        [
          canvas.getByRole('button', { name: 'Slower by 5 %' }),
          canvas.getByRole('button', { name: 'Faster by 5 %' }),
        ],
        64,
      )
    }
  },
}
