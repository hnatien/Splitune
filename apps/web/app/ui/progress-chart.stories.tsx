import type { Meta, StoryObj } from '@storybook/react-vite'
import type * as React from 'react'
import { expect, within } from 'storybook/test'
import { contrastRatio, sameColour, tokenColour } from './fixtures.ts'
import { ProgressChart, type ProgressPoint } from './progress-chart.tsx'
import { Sparkline } from './sparkline.tsx'
import { Stat, Stats } from './stat.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  DAYLIGHT,
  StateGrid,
  themeFrames,
} from './story-kit.tsx'

const meta = { title: 'Kit/Progress' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const END = new Date('2026-11-19T18:00:00Z')
const START = new Date(END.getTime() - 29 * 86_400_000)
const DOMAIN: [Date, Date] = [START, END]
const day = (n: number) => new Date(END.getTime() - n * 86_400_000)

const NINE: ProgressPoint[] = [
  [27, 60, 50],
  [24, 60, 55],
  [21, 65, 55],
  [17, 70, 60],
  [13, 70, 60],
  [10, 70, 65],
  [6, 75, 65],
  [3, 75, 70],
  [0, 80, 70],
].map(([ago, best, cold]) => ({ at: day(ago ?? 0), best: best ?? 0, cold: cold ?? 0 }))

const LEGEND = {
  best: 'Best clean pass of the session',
  cold: 'First clean pass, cold: what really stuck',
}
const LABEL = 'Best clean speed rose from 60 to 80 percent over 9 sessions'

/** The one side panel, where the Progress tab sits. */
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="w-85 max-w-full bg-panel p-4">{children}</div>
}

const nine = () => (
  <Frame>
    <ProgressChart points={NINE} domain={DOMAIN} label={LABEL} legend={LEGEND} />
  </Frame>
)

/** 26 §12.2 ProgressChart: nine sessions, best solid ink with dots, cold dashed with squares;
 * both lines ≥ 3:1 on the panel, and the scale in tabular figures no smaller than 11 px. */
export const NineSessions: Story = {
  globals: BOTH_THEMES,
  render: nine,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const chart = within(frame).getByRole('img', { name: LABEL })
      await expect(chart.querySelectorAll('[data-marker=best]')).toHaveLength(9)
      await expect(chart.querySelectorAll('[data-marker=cold]')).toHaveLength(9)
      // Not colour alone: the cold series is dashed and its markers are squares.
      const cold = chart.querySelector('[data-series=cold]') as SVGPathElement
      await expect(cold.getAttribute('stroke-dasharray')).toBe('4 4')
      const square = chart.querySelector('[data-marker=cold]') as HTMLElement
      await expect(getComputedStyle(square).borderTopLeftRadius).toBe('0px')
      const dot = chart.querySelector('[data-marker=best]') as HTMLElement
      await expect(getComputedStyle(dot).borderTopLeftRadius).not.toBe('0px')
      await expect(within(frame).getByText(LEGEND.cold)).toBeVisible()
      await expect(Math.round(chart.getBoundingClientRect().height)).toBe(120)
      const panel = tokenColour('--panel', frame)
      const best = chart.querySelector('[data-series=best]') as SVGPathElement
      await expect(sameColour(getComputedStyle(best).stroke, tokenColour('--signal', frame))).toBe(
        true,
      )
      for (const series of [best, cold]) {
        await expect(contrastRatio(getComputedStyle(series).stroke, panel)).toBeGreaterThanOrEqual(
          3,
        )
      }
      for (const tick of chart.querySelectorAll<HTMLElement>('span > span')) {
        const style = getComputedStyle(tick)
        await expect(Number.parseFloat(style.fontSize)).toBeGreaterThanOrEqual(11)
        await expect(style.fontVariantNumeric).toContain('tabular-nums')
      }
    }
  },
}

/** One session: two markers and no line yet. */
export const OneSession: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <Frame>
      <ProgressChart
        points={[{ at: END, best: 60, cold: 55 }]}
        domain={DOMAIN}
        label="Best clean speed 60 percent in one session"
        legend={LEGEND}
      />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const chart = within(canvasElement).getAllByRole('img')[0] as HTMLElement
    await expect(chart.querySelectorAll('[data-marker]')).toHaveLength(2)
  },
}

/** Daily sessions for 30 days, with a plateau and a dip: markers stay apart at 344 px. */
export const ThirtyDays: Story = {
  globals: DAYLIGHT,
  render: () => (
    <Frame>
      <ProgressChart
        points={Array.from({ length: 30 }, (_, i) => ({
          at: day(29 - i),
          best: Math.min(100, 50 + i * 2 - (i % 7 === 3 ? 6 : 0)),
          cold: Math.min(95, 45 + i * 2 - (i % 5 === 0 ? 5 : 0)),
        }))}
        domain={DOMAIN}
        label="Best clean speed rose from 50 to 100 percent over 30 sessions"
        legend={LEGEND}
      />
    </Frame>
  ),
}

export const IncreasedContrast: Story = {
  globals: BOTH_THEMES_MORE_CONTRAST,
  render: nine,
}

/** The library's 30-day line (27 §3.5). */
export const Sparklines: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <StateGrid
      states={[
        [
          'Nine sessions',
          <div key="9" className="w-75 bg-panel p-4">
            <Sparkline
              values={NINE.map((p) => ({ at: p.at, value: p.best }))}
              domain={DOMAIN}
              label={LABEL}
            />
          </div>,
        ],
        [
          'One session',
          <div key="1" className="w-75 bg-panel p-4">
            <Sparkline
              values={[{ at: END, value: 70 }]}
              domain={DOMAIN}
              label="Best clean speed 70 percent in one session"
            />
          </div>,
        ],
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      await expect(within(frame).getByRole('img', { name: LABEL })).toBeVisible()
    }
  },
}

/** The figures beside the chart (26 §12.2 Stat, which replaced StatCard): tabular figures over
 * their labels with no card, so a changing figure never moves its neighbours. */
export const StatRow: Story = {
  globals: BOTH_THEMES,
  render: () => (
    <Frame>
      <Stats>
        <Stat value="55 %" label="cold start today" />
        <Stat value="9 / 14" label="clean passes" />
        <Stat value="18 min" label="today" />
      </Stats>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const value = within(frame).getByText('9 / 14')
      await expect(getComputedStyle(value).fontVariantNumeric).toContain('tabular-nums')
      await expect(within(frame).getByText('clean passes')).toBeVisible()
    }
  },
}
