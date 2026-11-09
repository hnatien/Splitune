import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import { expect, within } from 'storybook/test'

// Fonts (docs/specs/26-design-system.md §6.1, 28 §3 "Fonts"). TabularReadouts is the browser half
// of the font check (scripts/fonts/fonts.test.mjs checks the files): JetBrains Mono readouts and
// Instrument Sans tabular figures keep their width as the digits change. Legibility is the page for
// the owner's s32 legibility check: JetBrains Mono tab digits against Instrument Sans and Inter 4
// tabular digits on the confusable pairs, at the Desk, Music stand and Floor tab sizes.

const meta = { title: 'Foundations/Fonts', parameters: { layout: 'padded' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** Readouts as the transport and the Now column show them; each row keeps its digit count. */
const READOUTS = [
  ['Position', ['0:00 / 3:12', '1:11 / 1:11', '8:48 / 9:59']],
  ['Speed', ['70 % · 84 BPM', '11 % · 11 BPM', '98 % · 80 BPM']],
  ['Bar and beat', ['17.3', '11.1', '88.4']],
  ['Gain', ['−3 dB', '−1 dB', '+8 dB']],
  ['Tab digits', ['0 3 12 15', '1 1 11 11', '8 8 88 80']],
] as const

function Readouts() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xl">JetBrains Mono readouts</h2>
        <dl className="grid grid-cols-[10rem_1fr] items-baseline gap-x-6 gap-y-3">
          {READOUTS.map(([label, variants]) => (
            <div key={label} className="contents">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="m-0 flex flex-wrap gap-6" data-readout={label}>
                {variants.map((text) => (
                  <span key={text} className="w-fit font-mono text-read-readout tabular-nums">
                    {text}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Instrument Sans tabular figures</h2>
        <div className="flex flex-col gap-2 text-2xl">
          <span data-testid="sans-tnum-ones" className="w-fit tabular-nums">
            1111111111
          </span>
          <span data-testid="sans-tnum-digits" className="w-fit tabular-nums">
            0123456789
          </span>
          <span data-testid="sans-pnum-ones" className="w-fit">
            1111111111
          </span>
        </div>
      </section>
    </div>
  )
}

const width = (element: Element) => element.getBoundingClientRect().width

export const TabularReadouts: Story = {
  render: Readouts,
  play: async ({ canvasElement }) => {
    await document.fonts.ready
    // Measured in the real faces, not the metric-matched fallbacks.
    await expect(document.fonts.check('600 1em "JetBrains Mono"')).toBe(true)
    await expect(document.fonts.check('400 1em "Instrument Sans"')).toBe(true)
    for (const row of canvasElement.querySelectorAll('[data-readout]')) {
      const spans = [...row.querySelectorAll('span')]
      await expect(getComputedStyle(spans[0] as Element).fontFamily).toMatch(/^"?JetBrains Mono"?,/)
      const widths = spans.map(width)
      for (const value of widths) await expect(value).toBeCloseTo(widths[0] ?? 0, 1)
    }
    const canvas = within(canvasElement)
    await expect(width(canvas.getByTestId('sans-tnum-ones'))).toBeCloseTo(
      width(canvas.getByTestId('sans-tnum-digits')),
      0,
    )
    await expect(width(canvas.getByTestId('sans-pnum-ones'))).toBeLessThan(
      width(canvas.getByTestId('sans-tnum-ones')),
    )
  },
}

const PAIRS = ['1 7 7 1 1 7', '3 8 8 3 8 3', '6 0 0 6 0 6', '17 38 60 71 83 06']
const DISTANCES = [
  ['desk', 'Desk · 0.5 m'],
  ['stand', 'Music stand · 0.75 m'],
  ['floor', 'Floor · 1.5 m'],
] as const
// Inter 4 is not shipped since s32 (its recipe is in scripts/fonts/subset.sh's history); this page
// loads it from Google Fonts for the comparison only.
const INTER_CSS = 'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700'
const FAMILIES = [
  ['JetBrains Mono', 'font-mono', undefined],
  ['Instrument Sans (tabular)', 'font-sans tabular-nums', undefined],
  ['Inter 4 (tabular, from Google Fonts)', 'tabular-nums', '"Inter", sans-serif'],
] as const

function LegibilityCheck() {
  useEffect(() => {
    const link = document.head.appendChild(document.createElement('link'))
    link.rel = 'stylesheet'
    link.href = INTER_CSS
    return () => link.remove()
  }, [])
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-reading text-base text-muted-foreground">
        Put the screen at each distance and read every row aloud: which digits can you tell apart
        without leaning in? Tab digits are 600 weight at the distance preset's --read-tab size.
      </p>
      {DISTANCES.map(([distance, label]) => (
        <section
          key={distance}
          data-distance={distance}
          aria-label={label}
          className="flex flex-col gap-4"
        >
          <h2 className="text-xl">{label}</h2>
          {FAMILIES.map(([name, classes, family]) => (
            <figure key={name} className="m-0 flex flex-col gap-1">
              <figcaption className="text-sm text-muted-foreground">{name}</figcaption>
              <div
                className={`flex flex-wrap gap-x-10 gap-y-2 rounded-lg bg-paper px-4 py-2 text-read-tab text-ink ${classes}`}
                style={family ? { fontFamily: family } : undefined}
              >
                {PAIRS.map((pair) => (
                  <span key={pair}>{pair}</span>
                ))}
              </div>
            </figure>
          ))}
        </section>
      ))}
    </div>
  )
}

export const Legibility: Story = {
  render: LegibilityCheck,
  play: async ({ canvasElement }) => {
    // Each distance block reads at its own preset's tab size (26 §6.3: 24 / 36 / 54 px).
    const sizes = [...canvasElement.querySelectorAll('section [class*="text-read-tab"]')].map(
      (element) => getComputedStyle(element).fontSize,
    )
    await expect(sizes).toEqual([
      '24px',
      '24px',
      '24px',
      '36px',
      '36px',
      '36px',
      '54px',
      '54px',
      '54px',
    ])
  },
}
