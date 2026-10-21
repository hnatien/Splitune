import {
  CONTRAST_PAIRS,
  MOTION_TOKENS,
  READING_TOKENS,
  readColor,
  readToken,
  STEMS,
  TARGET_TOKENS,
  type TokenName,
} from '@splitune/ui-tokens'
import type { Meta, StoryObj } from '@storybook/react-vite'
import Color from 'colorjs.io'
import {
  AudioWaveformIcon,
  CheckIcon,
  DrumIcon,
  GaugeIcon,
  GuitarIcon,
  HeadphonesIcon,
  KeyboardIcon,
  MetronomeIcon,
  MicIcon,
  MinusIcon,
  PauseIcon,
  PianoIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  SkipBackIcon,
  SlidersVerticalIcon,
  TimerResetIcon,
  XIcon,
} from 'lucide-react'
import { useLayoutEffect, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from './button.tsx'
import { applyDisplay } from './display.ts'
import { CUSTOM_ICONS } from './icons/index.tsx'

// Foundations (docs/implementation/26-design-system.md §4–§11, 28 §2): what the tokens resolve to in
// the current appearance, contrast, distance and motion settings, read live from the cascade.

const meta = { title: 'Foundations/Overview', parameters: { layout: 'padded' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function ratio(fg: TokenName, bg: TokenName) {
  return new Color(readColor(fg)).contrast(new Color(readColor(bg)), 'WCAG21')
}

/** Reads a value from the live cascade and re-reads it when <html> data-* attributes change. */
function useLive<T>(read: () => T): T | undefined {
  const [value, setValue] = useState<T>()
  useLayoutEffect(() => {
    const update = () => setValue(read())
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [read])
  return value
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl">{title}</h2>
      {children}
    </section>
  )
}

const readContrast = () =>
  CONTRAST_PAIRS.map(([fg, bg, min]) => ({ fg, bg, min, value: ratio(fg, bg) }))
/** Custom properties hold unresolved calc(); a probe element gives the computed pixel size. */
const readReadingSizes = () =>
  READING_TOKENS.map((token) => {
    const probe = document.createElement('span')
    probe.style.fontSize = `var(${token})`
    document.body.append(probe)
    const size = getComputedStyle(probe).fontSize
    probe.remove()
    return [token, size] as const
  })
const readDurations = () => MOTION_TOKENS.map((token) => [token, readToken(token)] as const)

function ContrastTable() {
  const rows = useLive(readContrast) ?? []
  return (
    <table className="w-full max-w-3xl border-collapse text-sm">
      <caption className="mb-2 text-left text-muted-foreground">
        WCAG 2.2 contrast of every checked pair, measured from the live tokens.
      </caption>
      <thead>
        <tr className="border-b border-border text-left">
          <th className="py-2 pr-3 font-semibold">Sample</th>
          <th className="py-2 pr-3 font-semibold">Foreground on background</th>
          <th className="py-2 pr-3 text-right font-semibold">Ratio</th>
          <th className="py-2 text-right font-semibold">Minimum</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const passes = row.value >= row.min
          return (
            <tr key={`${row.fg}${row.bg}`} data-passes={passes} className="border-b border-border">
              <td className="py-1.5 pr-3">
                {row.min >= 4.5 ? (
                  <span
                    className="inline-flex h-8 w-16 items-center justify-center rounded-md border border-border font-semibold"
                    style={{ color: `var(${row.fg})`, background: `var(${row.bg})` }}
                  >
                    Aa 7
                  </span>
                ) : (
                  // 3:1 pairs are graphics (WCAG 1.4.11), so the sample is a mark, not text.
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-16 items-center justify-center rounded-md border border-border"
                    style={{ background: `var(${row.bg})` }}
                  >
                    <span
                      className="h-1 w-10 rounded-full"
                      style={{ background: `var(${row.fg})` }}
                    />
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-xs">
                {row.fg} on {row.bg}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{row.value.toFixed(2)}:1</td>
              <td className="py-1.5 text-right tabular-nums">
                {passes ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckIcon aria-hidden className="size-4 text-success" />
                    {row.min}:1 met
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                    <XIcon aria-hidden className="size-4" />
                    below {row.min}:1
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const SURFACES: TokenName[] = ['--background', '--card', '--muted', '--accent']
const STEM_SWATCHES = Object.entries(STEMS)

function Colours() {
  return (
    <div className="flex flex-col gap-10">
      <Section title="Surfaces and score">
        <div className="flex flex-wrap gap-4">
          {SURFACES.map((token) => (
            <div key={token} className="flex flex-col gap-2">
              <span
                className="h-16 w-32 rounded-lg border border-border"
                style={{ background: `var(${token})` }}
              />
              <code className="text-xs">{token}</code>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <span className="flex h-16 w-48 items-center gap-3 rounded-lg border border-border bg-paper px-3 font-reading text-xl font-semibold">
              <span className="text-ink">3</span>
              <span className="rounded-sm border-[1.5px] border-dashed border-conf-medium px-1 text-conf-medium">
                5
              </span>
              <span className="rounded-sm border-[1.5px] border-dashed border-conf-low px-1 text-conf-low">
                7<sup className="text-xs">?</sup>
              </span>
            </span>
            <code className="text-xs">--paper with --ink and confidence inks</code>
          </div>
        </div>
      </Section>
      <Section title="Stems">
        <ul className="flex list-none flex-wrap gap-4 p-0">
          {STEM_SWATCHES.map(([kind, { token }]) => (
            <li key={kind} className="flex flex-col gap-2">
              <span className="h-10 w-24 rounded-md" style={{ background: `var(${token})` }} />
              <span className="text-sm capitalize">{kind}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Contrast">
        <ContrastTable />
      </Section>
    </div>
  )
}

export const ColourRoles: Story = {
  render: Colours,
  play: async ({ canvasElement }) => {
    const rows = await within(canvasElement).findAllByRole('row')
    await expect(rows.length).toBe(CONTRAST_PAIRS.length + 1)
    await expect(canvasElement.querySelectorAll('[data-passes=false]').length).toBe(0)
  },
}
export const ColourRolesDark: Story = { ...ColourRoles, globals: { appearance: 'dark' } }
export const ColourRolesStage: Story = { ...ColourRoles, globals: { appearance: 'stage' } }
export const ColourRolesIncreasedContrast: Story = { ...ColourRoles, globals: { contrast: 'more' } }

const TYPE_STEPS = [
  ['text-xs', 'Badge · 12/16 · 500', 'Ready'],
  ['text-sm', 'Secondary · 14/20', 'Practised 3 days ago'],
  ['text-base', 'Body · 16/24', 'Import a song you want to learn.'],
  ['text-lg', 'Card title · 18/28 · 500', 'Wish You Were Here'],
  ['text-xl', 'Section · 20/28 · 600', 'Display & practice'],
  ['text-2xl', 'Page title · 24/32 · 600', 'Library'],
  ['text-4xl', 'Marketing · 36/40 · 650', 'Practise the part you love'],
] as const

function Typography() {
  return (
    <div className="flex flex-col gap-10">
      <Section title="Browse scale">
        <dl className="grid grid-cols-[12rem_1fr] items-baseline gap-x-6 gap-y-3">
          {TYPE_STEPS.map(([step, use, sample]) => (
            <div key={step} className="contents">
              <dt className="text-sm text-muted-foreground">
                <code>{step}</code> · {use}
              </dt>
              <dd className={`m-0 ${step}`}>{sample}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Inter features (subset keeps every layout feature)">
        <div className="flex flex-col gap-2 text-2xl">
          <span data-testid="tnum-ones" className="w-fit tabular-nums">
            1111111111
          </span>
          <span data-testid="tnum-zeros" className="w-fit tabular-nums">
            0123456789
          </span>
          <span data-testid="pnum-ones" className="w-fit">
            1111111111
          </span>
          <span className="w-fit tabular-nums" style={{ fontFeatureSettings: '"zero"' }}>
            0:45 · 1:02:10 · 70 % · −3 dB
          </span>
          <span data-testid="frac-off" className="w-fit">
            1/2 3/4
          </span>
          <span data-testid="frac-on" className="w-fit" style={{ fontFeatureSettings: '"frac"' }}>
            1/2 3/4
          </span>
          <span data-testid="cv-off" className="w-fit">
            Illegal 1lI
          </span>
          <span
            data-testid="cv-on"
            className="w-fit"
            style={{ fontFeatureSettings: '"cv05", "cv08", "ss02"' }}
          >
            Illegal 1lI
          </span>
        </div>
      </Section>
    </div>
  )
}

const width = (element: HTMLElement) => element.getBoundingClientRect().width

export const TypeScale: Story = {
  render: Typography,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // tnum: ten tabular ones are as wide as ten tabular digits; proportional ones are narrower.
    await expect(width(canvas.getByTestId('tnum-ones'))).toBeCloseTo(
      width(canvas.getByTestId('tnum-zeros')),
      0,
    )
    await expect(width(canvas.getByTestId('pnum-ones'))).toBeLessThan(
      width(canvas.getByTestId('tnum-ones')),
    )
    // frac and the cv*/ss* alternates change glyphs, so they change the set width.
    await expect(width(canvas.getByTestId('frac-on'))).not.toBeCloseTo(
      width(canvas.getByTestId('frac-off')),
      0,
    )
    await expect(width(canvas.getByTestId('cv-on'))).not.toBeCloseTo(
      width(canvas.getByTestId('cv-off')),
      1,
    )
  },
}

function ReadingSizes() {
  const sizes = useLive(readReadingSizes) ?? []
  return (
    <Section title="Reading sizes for the current distance">
      <p className="text-sm text-muted-foreground">
        Set the Distance and Reading font toolbars; Stage adds one step (×1.25).
      </p>
      <dl className="grid grid-cols-[14rem_1fr] items-center gap-x-6 gap-y-4">
        <dt className="text-sm">
          <code>--read-tab</code>
        </dt>
        <dd
          data-testid="read-tab"
          className="m-0 flex gap-4 rounded-lg bg-paper px-4 py-2 font-reading text-read-tab text-ink tabular-nums"
        >
          <span>0</span>
          <span>3</span>
          <span>12</span>
          <span>15</span>
        </dd>
        <dt className="text-sm">
          <code>--read-chord-current</code>
        </dt>
        <dd className="m-0 font-reading text-read-chord-current">Am</dd>
        <dt className="text-sm">
          <code>--read-chord</code>
        </dt>
        <dd className="m-0 font-reading text-read-chord">F · C · G</dd>
        <dt className="text-sm">
          <code>--read-bar-number</code>
        </dt>
        <dd className="m-0 text-read-bar-number tabular-nums">Bar 17, beat 3</dd>
        <dt className="text-sm">
          <code>--read-readout</code>
        </dt>
        <dd className="m-0 font-reading text-read-readout tabular-nums">70&nbsp;% · 84&nbsp;BPM</dd>
        <dt className="text-sm">
          <code>--read-label</code>
        </dt>
        <dd className="m-0 text-read-label">Loop · bars 17–20</dd>
      </dl>
      <table className="max-w-md text-sm">
        <caption className="text-left text-muted-foreground">Computed sizes</caption>
        <tbody>
          {sizes.map(([token, value]) => (
            <tr key={token}>
              <th scope="row" className="pr-4 text-left font-normal">
                <code>{token}</code>
              </th>
              <td className="tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

export const Reading: Story = { render: ReadingSizes }
export const ReadingAtTheStand: Story = {
  render: ReadingSizes,
  globals: { distance: 'stand' },
  play: async ({ canvasElement }) => {
    // Stand: 36 px fret digits (22 arcminutes at 0.75 m, doc 26 §6.3).
    await expect(getComputedStyle(within(canvasElement).getByTestId('read-tab')).fontSize).toBe(
      '36px',
    )
  },
}
export const ReadingStageStand: Story = {
  render: ReadingSizes,
  globals: { appearance: 'stage', distance: 'stand' },
  play: async ({ canvasElement }) => {
    // Stage adds one step: 36 × 1.25.
    await expect(getComputedStyle(within(canvasElement).getByTestId('read-tab')).fontSize).toBe(
      '45px',
    )
  },
}
export const ReadingHyperlegible: Story = {
  render: ReadingSizes,
  globals: { readingFont: 'hyperlegible', distance: 'stand' },
}

function Targets() {
  return (
    <Section title="Targets (CSS px)">
      <div className="flex flex-wrap items-end gap-6">
        {TARGET_TOKENS.map((token) => (
          <figure key={token} className="m-0 flex flex-col items-center gap-2">
            <span
              data-target={token}
              className="block rounded-md border-2 border-dashed border-input bg-muted"
              style={{ width: `var(${token})`, height: `var(${token})` }}
            />
            <figcaption className="text-xs">
              <code>{token}</code>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  )
}

export const TargetSizes: Story = {
  render: Targets,
  play: async ({ canvasElement }) => {
    const expected: Record<string, number> = {
      '--target-min': 24,
      '--target-sm': 32,
      '--target': 44,
      '--target-practice-2': 48,
      '--target-practice': 64,
    }
    for (const element of canvasElement.querySelectorAll<HTMLElement>('[data-target]')) {
      await expect(element.getBoundingClientRect().height).toBe(
        expected[element.getAttribute('data-target') ?? ''],
      )
    }
  },
}

function Motion() {
  const [moved, setMoved] = useState(false)
  const durations = useLive(readDurations) ?? []
  return (
    <Section title="Motion">
      <table className="max-w-md text-sm">
        <tbody>
          {durations.map(([token, value]) => (
            <tr key={token}>
              <th scope="row" className="pr-4 text-left font-normal">
                <code>{token}</code>
              </th>
              <td className="tabular-nums" data-duration={token}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4">
        <Button onClick={() => setMoved(!moved)}>Move</Button>
        <span className="relative h-10 w-64 rounded-md bg-muted">
          <span
            className="absolute top-1 left-1 size-8 rounded-sm bg-primary transition-transform duration-(--duration-slow) ease-standard"
            style={{ transform: moved ? 'translateX(13rem)' : 'none' }}
          />
        </span>
      </div>
    </Section>
  )
}

export const MotionTokens: Story = { render: Motion }
export const MotionReduced: Story = {
  render: Motion,
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-duration="--duration-slow"]')).toHaveTextContent(
        '0ms',
      ),
    )
  },
}

const TRANSPORT = {
  PlayIcon,
  PauseIcon,
  RepeatIcon,
  SkipBackIcon,
  MinusIcon,
  PlusIcon,
  GaugeIcon,
  MetronomeIcon,
  TimerResetIcon,
  SlidersVerticalIcon,
  AudioWaveformIcon,
  MicIcon,
  HeadphonesIcon,
  GuitarIcon,
  PianoIcon,
  DrumIcon,
  KeyboardIcon,
}

function Icons() {
  return (
    <Section title="Icons (Lucide 24 px grid, 2 px stroke)">
      {[
        ['Transport set', TRANSPORT],
        ['Custom music icons', CUSTOM_ICONS],
      ].map(([title, set]) => (
        <div key={title as string} className="flex flex-col gap-3">
          <h3 className="text-lg">{title as string}</h3>
          <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3 p-0">
            {Object.entries(set as Record<string, typeof PlayIcon>).map(([name, Icon]) => (
              <li
                key={name}
                className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
              >
                <Icon aria-hidden className="size-6 shrink-0" />
                {name.replace(/Icon$/, '')}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  )
}

export const IconSet: Story = { render: Icons }

/**
 * The appearance switch as the app does it (applyDisplay on <html>): every component follows
 * without a reload.
 */
function AppearanceSwitch() {
  const [appearance, setAppearance] = useState<'light' | 'dark' | 'stage'>('light')
  useLayoutEffect(() => {
    applyDisplay({ appearance }, document.documentElement, (query) => window.matchMedia(query))
  }, [appearance])
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex gap-2 border-0 p-0">
        <legend className="sr-only">Appearance</legend>
        {(['light', 'dark', 'stage'] as const).map((value) => (
          <Button
            key={value}
            variant={value === appearance ? 'primary' : 'outline'}
            aria-pressed={value === appearance}
            onClick={() => setAppearance(value)}
            className="capitalize"
          >
            {value}
          </Button>
        ))}
      </fieldset>
      <Colours />
    </div>
  )
}

export const SwitchAppearance: Story = {
  render: AppearanceSwitch,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const background = () => readColor('--background')
    const light = background()
    await userEvent.click(canvas.getByRole('button', { name: 'dark' }))
    await expect(document.documentElement).toHaveAttribute('data-appearance', 'dark')
    await expect(document.documentElement).toHaveClass('dark')
    await expect(background()).not.toBe(light)
    await userEvent.click(canvas.getByRole('button', { name: 'stage' }))
    await expect(document.documentElement).toHaveAttribute('data-appearance', 'stage')
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-passes=false]').length).toBe(0),
    )
  },
}
