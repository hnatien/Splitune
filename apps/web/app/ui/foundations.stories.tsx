import {
  CONTRAST_PAIRS,
  MOTION_TOKENS,
  RAMP_STEPS,
  READING_TOKENS,
  ROLE_STEPS,
  readColor,
  readToken,
  STEMS,
  type StemKind,
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
import { Status, type StatusKind } from './status.tsx'
import {
  BOTH_THEMES,
  BOTH_THEMES_MORE_CONTRAST,
  resolve,
  shadowsOf,
  themeFrames,
} from './story-kit.tsx'

// Foundations (docs/specs/26-design-system.md §4–§11, s47 direction §4–§5, 28 §2): the token
// system as it resolves live in the current appearance, contrast, distance and motion settings.
// Twelve role-numbered grey steps per theme, the roles that read each one, the contrast every pair
// is held to, type by role, reading sizes, targets, radii, the two shadows, motion, status and
// stems, increased contrast and Stage.

const meta = { title: 'Foundations/Overview', parameters: { layout: 'padded' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function ratio(fg: TokenName, bg: TokenName, probe: Element) {
  return new Color(readColor(fg, probe)).contrast(new Color(readColor(bg, probe)), 'WCAG21')
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
      <h2 className="text-display">{title}</h2>
      {children}
    </section>
  )
}

/**
 * readColor attaches a probe to the element it is given. On <html> that restyles the whole page
 * for every read (132 per pass; WebKit takes over a second), so the pairs are read from an empty
 * element, which inherits the same tokens.
 */
const readContrast = () => {
  const probe = document.body.appendChild(document.createElement('div'))
  try {
    return CONTRAST_PAIRS.map(([fg, bg, min]) => ({ fg, bg, min, value: ratio(fg, bg, probe) }))
  } finally {
    probe.remove()
  }
}
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

/** What each step of the ramp is for (s47 direction §4.2); the same job in Dark and Light. */
const STEP_JOBS: Record<number, string> = {
  1: 'Page and notation paper',
  2: 'The one side panel, wells, skeletons',
  3: 'Popovers, menus, sheets, dialogs, toasts',
  4: 'Hover; the wash under a current bar or row',
  5: 'Pressed',
  6: 'Decorative hairline (no minimum)',
  7: 'The ring of a control that also has a label or icon',
  8: "A control's only boundary, slider tracks, staff lines (≥ 3:1 on 1–4)",
  9: 'Dimmed chrome text (≥ 4.5:1 on 1–4)',
  10: 'Secondary text (≥ 7:1 on 1)',
  11: 'Hover of a filled ink control',
  12: 'Ink: text, notation, the filled control, selection, focus, playhead',
}

/** The roles that read each step, from ROLE_STEPS. */
const ROLES_BY_STEP = Object.entries(ROLE_STEPS).reduce<Record<number, string[]>>(
  (byStep, [role, step]) => {
    byStep[step] = [...(byStep[step] ?? []), role]
    return byStep
  },
  {},
)

function Ramp() {
  return (
    <ol className="m-0 grid list-none gap-0 p-0">
      {RAMP_STEPS.map((token, index) => {
        const step = index + 1
        return (
          <li
            key={token}
            data-step={step}
            className="grid grid-cols-[4rem_3rem_minmax(0,1fr)] items-center gap-3 border-b border-border py-2"
          >
            <span
              data-swatch={token}
              aria-hidden
              className="h-10 rounded-media border border-border"
              style={{ background: `var(${token})` }}
            />
            <code className="text-label-sm tabular-nums">{step}</code>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body-sm">{STEP_JOBS[step]}</span>
              <code className="truncate text-caption text-muted-foreground">
                {(ROLES_BY_STEP[step] ?? []).join(' · ')}
              </code>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The twelve-step ramp in Dark and Light: each step's job and the roles that read it. Every step
 * is an achromatic grey, and every role resolves to the step ROLE_STEPS names for it.
 */
export const GreyRamp: Story = {
  render: () => (
    <Section title="The grey ramp">
      <Ramp />
    </Section>
  ),
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      await expect(frame.querySelectorAll('[data-step]')).toHaveLength(12)
      const probe = frame.querySelector('[data-swatch]') as HTMLElement
      for (const token of RAMP_STEPS) {
        const chroma = new Color(resolve(probe, 'backgroundColor', token)).to('oklch').c
        await expect(Math.abs(chroma ?? 0), `${token} chroma`).toBeLessThan(0.005)
      }
      for (const [role, step] of Object.entries(ROLE_STEPS)) {
        await expect(resolve(probe, 'backgroundColor', role), `${role} reads step ${step}`).toBe(
          resolve(probe, 'backgroundColor', `--gray-${step}`),
        )
      }
    }
  },
}

/** Dark and Light are tuned apart, not mirrored: Light's raised step is lighter than its page. */
export const GreyRampTunedApart: Story = {
  render: () => <Ramp />,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    const [dark, light] = themeFrames(canvasElement) as [HTMLElement, HTMLElement]
    const lightness = (frame: HTMLElement, token: string) =>
      new Color(
        resolve(frame.querySelector('[data-swatch]') as HTMLElement, 'backgroundColor', token),
      ).to('oklch').l ?? 0
    await expect(lightness(light, '--gray-3')).toBeGreaterThan(lightness(light, '--gray-1'))
    await expect(lightness(dark, '--gray-3')).toBeGreaterThan(lightness(dark, '--gray-1'))
    await expect(lightness(dark, '--gray-12')).toBeGreaterThan(lightness(dark, '--gray-1'))
    await expect(lightness(light, '--gray-12')).toBeLessThan(lightness(light, '--gray-1'))
  },
}

function ContrastTable() {
  const rows = useLive(readContrast) ?? []
  return (
    <table className="w-full max-w-3xl border-collapse text-body-sm">
      <caption className="mb-2 text-left text-muted-foreground">
        WCAG 2.2 contrast of every checked pair, measured from the live tokens.
      </caption>
      <thead>
        <tr className="border-b border-border text-left">
          <th className="py-2 pr-3 font-medium">Sample</th>
          <th className="py-2 pr-3 font-medium">Foreground on background</th>
          <th className="py-2 pr-3 text-right font-medium">Ratio</th>
          <th className="py-2 text-right font-medium">Minimum</th>
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
                    className="inline-flex h-8 w-16 items-center justify-center rounded-media border border-border font-medium"
                    style={{ color: `var(${row.fg})`, background: `var(${row.bg})` }}
                  >
                    Aa 7
                  </span>
                ) : (
                  // 3:1 pairs are graphics (WCAG 1.4.11), so the sample is a mark, not text.
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-16 items-center justify-center rounded-media border border-border"
                    style={{ background: `var(${row.bg})` }}
                  >
                    <span
                      className="h-1 w-10 rounded-full"
                      style={{ background: `var(${row.fg})` }}
                    />
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-caption">
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
                  <span className="inline-flex items-center gap-1 font-medium text-destructive">
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

const STATUS_KINDS: [StatusKind, string][] = [
  ['ready', 'Ready'],
  ['working', 'Isolating your part'],
  ['queued', 'Queued'],
  ['attention', 'Rough tab'],
  ['failed', 'Upload failed'],
  ['partial', 'Chords only'],
  ['expired', 'Stems expired'],
  ['paused', 'Upload not finished'],
  ['offline', 'Processing machine offline'],
]
const STEM_SWATCHES = Object.entries(STEMS) as [StemKind, (typeof STEMS)[StemKind]][]
const STEM_ICONS = {
  guitar: GuitarIcon,
  drum: DrumIcon,
  mic: MicIcon,
  piano: PianoIcon,
  'audio-waveform': AudioWaveformIcon,
} as const

function Colours() {
  return (
    <div className="flex flex-col gap-10">
      <Section title="Score">
        <span className="flex h-16 w-56 items-center gap-3 rounded-field border border-border bg-paper px-3 font-reading text-heading">
          <span className="text-ink">3</span>
          <span className="rounded-media border-[1.5px] border-dotted border-conf-medium-edge px-1 text-conf-medium">
            5
          </span>
          <span className="rounded-media border-[1.5px] border-dashed border-conf-low-edge px-1 text-conf-low">
            7<sup className="text-caption text-conf-low-edge">?</sup>
          </span>
        </span>
        <p className="text-caption text-muted-foreground">
          Every digit is the ink; probably is a dotted edge, unsure a dashed unsure-blue edge and a
          “?”.
        </p>
      </Section>
      <Section title="Status: a glyph and words">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {STATUS_KINDS.map(([kind, words]) => (
            <Status key={kind} kind={kind} {...(kind === 'working' ? { progress: 0.4 } : {})}>
              {words}
            </Status>
          ))}
        </div>
      </Section>
      <Section title="Stems: a colour and an icon">
        <ul className="m-0 flex list-none flex-wrap gap-6 p-0">
          {STEM_SWATCHES.map(([kind, { token, icon }]) => {
            const Icon = STEM_ICONS[icon]
            return (
              <li key={kind} data-stem={token} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-6 w-1 rounded-full"
                  style={{ background: `var(${token})` }}
                />
                <Icon aria-hidden className="size-4 text-muted-foreground" />
                <span className="text-label-sm capitalize">{kind}</span>
              </li>
            )
          })}
        </ul>
      </Section>
      <Section title="Contrast">
        <ContrastTable />
      </Section>
    </div>
  )
}

/** The live contrast table: every pair in CONTRAST_PAIRS meets its minimum here. */
export const ColourRoles: Story = {
  render: Colours,
  globals: { appearance: 'light' },
  play: async ({ canvasElement }) => {
    const rows = await within(canvasElement).findAllByRole('row')
    await expect(rows.length).toBe(CONTRAST_PAIRS.length + 1)
    await expect(canvasElement.querySelectorAll('[data-passes=false]').length).toBe(0)
    // Status says its state by shape: nine glyphs, nine shapes.
    const glyphs = [...canvasElement.querySelectorAll('[data-slot=status] svg')].map(
      (svg) => svg.innerHTML,
    )
    await expect(new Set(glyphs).size).toBe(STATUS_KINDS.length)
    // Each stem has its icon beside its colour.
    for (const stem of canvasElement.querySelectorAll('[data-stem]'))
      await expect(stem.querySelector('svg')).not.toBeNull()
  },
}
export const ColourRolesDark: Story = { ...ColourRoles, globals: { appearance: 'dark' } }
export const ColourRolesStage: Story = { ...ColourRoles, globals: { appearance: 'stage' } }
export const ColourRolesIncreasedContrast: Story = {
  ...ColourRoles,
  globals: { appearance: 'light', contrast: 'more' },
}
export const ColourRolesIncreasedContrastDark: Story = {
  ...ColourRoles,
  globals: { appearance: 'dark', contrast: 'more' },
}

/**
 * Increased contrast moves secondary and faint text, hairlines and control edges one step up the
 * ramp (the "-more" roles) and the focus outline to 3 px, in both themes.
 */
export const IncreasedContrast: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="text-body text-muted-foreground">Secondary text one step stronger.</p>
      <p className="text-body text-faint-foreground">Faint text one step stronger.</p>
      <span data-edge className="block h-10 w-48 rounded-field border border-edge" />
      <Button>Focus me</Button>
    </div>
  ),
  globals: BOTH_THEMES_MORE_CONTRAST,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const probe = frame.querySelector('[data-edge]') as HTMLElement
      const at = (token: string) => resolve(probe, 'backgroundColor', token)
      await expect(at('--muted-foreground')).toBe(at('--gray-11'))
      await expect(at('--faint-foreground')).toBe(at('--gray-10'))
      await expect(at('--edge')).toBe(at('--gray-9'))
      await expect(at('--border')).toBe(at('--gray-7'))
      await expect(getComputedStyle(probe).getPropertyValue('--focus-width').trim()).toBe('3px')
    }
  },
}

const TYPE_STEPS = [
  ['text-kbd', 'Key cap · 11/14 · 500', '⌘K'],
  ['text-caption', 'Caption · 12/16', 'Guitar · A minor · 100 BPM'],
  ['text-label-sm', 'Small label · 13/18 · 500', 'Ready to practise'],
  ['text-body-sm', 'Secondary text · 13/18', 'Practised 3 days ago'],
  ['text-label', 'Label · 14/20 · 500', 'Resume practice'],
  ['text-body', 'Body · 15/22', 'Import a song you want to learn.'],
  ['text-title', 'Title · 17/24 · 500', 'Wish You Were Here'],
  ['text-lead', 'Lead · 17/26', 'Bring a song and practise your part.'],
  ['text-heading', 'Heading · 22/28 · 500', 'Display & practice'],
  ['text-readout', 'Readout · 28/34 · 500', '70 %'],
  ['text-display', 'Display · 32/38 · 500', 'Your library'],
  ['text-hero', 'Hero · 40–56 fluid · 500', 'Learn the part you love'],
] as const

function Typography() {
  return (
    <div className="flex flex-col gap-10">
      <Section title="Type by role: a text role is 400, a label role 500">
        <dl className="grid grid-cols-[14rem_1fr] items-baseline gap-x-6 gap-y-3">
          {TYPE_STEPS.map(([step, use, sample]) => (
            <div key={step} className="contents">
              <dt className="text-body-sm text-muted-foreground">
                <code>{step}</code> · {use}
              </dt>
              <dd data-role={step} className={`m-0 ${step}`}>
                {sample}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Figtree features (the subset keeps every layout feature)">
        <div className="flex flex-col gap-2 text-display">
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
    // Figtree keeps its frac feature (doc 26 §6.1), so built fractions set narrower; the ss*
    // alternates change glyphs, so they change the width too.
    await expect(width(canvas.getByTestId('frac-on'))).toBeLessThan(
      width(canvas.getByTestId('frac-off')),
    )
    await expect(width(canvas.getByTestId('cv-on'))).not.toBeCloseTo(
      width(canvas.getByTestId('cv-off')),
      1,
    )
    // Type by role (s47 direction §5): Figtree at 400 and 500 only, nothing below 11 px, and each
    // role at its size. The hero is fluid (40–56 px), so it is checked against its range.
    const roles = [...canvasElement.querySelectorAll<HTMLElement>('[data-role]')]
    await expect(roles).toHaveLength(TYPE_STEPS.length)
    for (const element of roles) {
      const role = element.getAttribute('data-role') as (typeof TYPE_STEPS)[number][0]
      const style = getComputedStyle(element)
      const size = Number.parseFloat(style.fontSize)
      await expect(['400', '500'], role).toContain(style.fontWeight)
      await expect(size, role).toBeGreaterThanOrEqual(11)
      if (role === 'text-hero') {
        await expect(size).toBeGreaterThanOrEqual(40)
        await expect(size).toBeLessThanOrEqual(56)
      } else await expect(size, role).toBe(ROLE_SIZES[role])
    }
  },
}

const ROLE_SIZES: Record<Exclude<(typeof TYPE_STEPS)[number][0], 'text-hero'>, number> = {
  'text-kbd': 11,
  'text-caption': 12,
  'text-label-sm': 13,
  'text-body-sm': 13,
  'text-label': 14,
  'text-body': 15,
  'text-title': 17,
  'text-lead': 17,
  'text-heading': 22,
  'text-readout': 28,
  'text-display': 32,
}

function ReadingSizes() {
  const sizes = useLive(readReadingSizes) ?? []
  return (
    <Section title="Reading sizes for the current distance">
      <p className="text-body-sm text-muted-foreground">
        Set the Distance and Reading font toolbars; Stage adds one step (×1.25).
      </p>
      <dl className="grid grid-cols-[14rem_1fr] items-center gap-x-6 gap-y-4">
        <dt className="text-body-sm">
          <code>--read-tab</code>
        </dt>
        <dd
          data-testid="read-tab"
          className="m-0 flex gap-4 rounded-field bg-paper px-4 py-2 font-reading text-read-tab text-ink tabular-nums"
        >
          <span>0</span>
          <span>3</span>
          <span>12</span>
          <span>15</span>
        </dd>
        <dt className="text-body-sm">
          <code>--read-chord-current</code>
        </dt>
        <dd className="m-0 font-reading text-read-chord-current">Am</dd>
        <dt className="text-body-sm">
          <code>--read-chord</code>
        </dt>
        <dd className="m-0 font-reading text-read-chord">F · C · G</dd>
        <dt className="text-body-sm">
          <code>--read-bar-number</code>
        </dt>
        <dd className="m-0 text-read-bar-number tabular-nums">Bar 17, beat 3</dd>
        <dt className="text-body-sm">
          <code>--read-readout</code>
        </dt>
        <dd className="m-0 font-reading text-read-readout tabular-nums">70&nbsp;% · 84&nbsp;BPM</dd>
        <dt className="text-body-sm">
          <code>--read-label</code>
        </dt>
        <dd className="m-0 text-read-label">Loop · bars 17–20</dd>
      </dl>
      <table className="max-w-md text-body-sm">
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
              className="block rounded-media border-2 border-dashed border-edge bg-panel"
              style={{ width: `var(${token})`, height: `var(${token})` }}
            />
            <figcaption className="text-caption">
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
      '--target': 44,
      '--target-practice': 48,
      '--target-play': 64,
      '--target-stand': 88,
    }
    for (const element of canvasElement.querySelectorAll<HTMLElement>('[data-target]')) {
      await expect(element.getBoundingClientRect().height).toBe(
        expected[element.getAttribute('data-target') ?? ''],
      )
    }
  },
}

const LAYERS = [
  ['--background', 'Page', 'shadow-none'],
  ['--panel', 'The one side panel (docked: no shadow)', 'shadow-none'],
  ['--raised', 'Popovers, menus, toasts: --elevation-popover', 'shadow-popover'],
  ['--raised', 'Dialogs and sheets: --elevation-dialog', 'shadow-dialog'],
] as const

function Layers() {
  return (
    <div className="flex flex-col gap-10">
      <Section title="Layers and the two shadows">
        <p className="max-w-reading text-body-sm text-muted-foreground">
          Only floating layers cast a shadow, two translucent black layers each, and never as their
          only boundary: each also has one hairline.
        </p>
        <div className="flex flex-wrap gap-6 bg-background p-6">
          {LAYERS.map(([surface, use, shadow]) => (
            <figure
              key={use}
              data-layer={shadow}
              className={`m-0 flex h-28 w-56 flex-col justify-end gap-1 border border-border p-4 ${
                shadow === 'shadow-dialog' ? 'rounded-dialog' : 'rounded-panel'
              } ${shadow}`}
              style={{ background: `var(${surface})` }}
            >
              <code className="text-caption">{surface}</code>
              <figcaption className="text-caption text-muted-foreground">{use}</figcaption>
            </figure>
          ))}
        </div>
      </Section>
      <Section title="Scrim">
        <div className="relative h-24 w-72 overflow-hidden rounded-panel bg-paper p-3 text-ink">
          Score under a dialog scrim
          <span data-testid="scrim" className="absolute inset-y-0 right-0 w-1/2 bg-scrim" />
        </div>
      </Section>
    </div>
  )
}

/** Two shadows, both two translucent black layers; the page and the docked panel cast none. */
export const Shadows: Story = {
  render: Layers,
  globals: BOTH_THEMES,
  play: async ({ canvasElement }) => {
    for (const frame of themeFrames(canvasElement)) {
      const layer = (name: string) => frame.querySelector(`[data-layer="${name}"]`) as HTMLElement
      await expect(shadowsOf(layer('shadow-none'))).toEqual([])
      const popover = shadowsOf(layer('shadow-popover'))
      const dialog = shadowsOf(layer('shadow-dialog'))
      await expect(popover).toHaveLength(2)
      await expect(dialog).toHaveLength(2)
      await expect(dialog.at(-1)?.blur).toBeGreaterThan(popover.at(-1)?.blur ?? 0)
      for (const shadow of [...popover, ...dialog]) {
        const color = new Color(shadow.color)
        await expect(color.to('oklch').l ?? 1).toBeLessThan(0.01)
        await expect(color.alpha.valueOf()).toBeLessThan(1)
      }
      // Each floating layer also keeps its hairline, so the shadow is never the only boundary.
      await expect(getComputedStyle(layer('shadow-popover')).borderTopWidth).toBe('1px')
    }
  },
}
export const ShadowsIncreasedContrast: Story = { ...Shadows, globals: BOTH_THEMES_MORE_CONTRAST }

// Doc 26 §9, s47 direction §4.6: radii named by what they round; a child's never exceeds its
// parent's.
const RADII = [
  ['rounded-media', '6 px · media, key caps'],
  ['rounded-field', '10 px · fields'],
  ['rounded-panel', '14 px · the panel, menus, popovers, toasts'],
  ['rounded-dialog', '20 px · dialogs, sheets'],
  ['rounded-full', 'Every control'],
] as const

function Shape() {
  return (
    <Section title="Radius scale">
      <div className="flex flex-wrap items-end gap-6">
        {RADII.map(([radius, use]) => (
          <figure key={radius} className="m-0 flex flex-col items-center gap-2">
            <span
              data-radius={radius}
              className={`block h-16 w-24 border border-edge bg-raised ${radius}`}
            />
            <figcaption className="text-center text-caption">
              <code>{radius}</code>
              <br />
              {use}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  )
}

export const RadiusScale: Story = {
  render: Shape,
  play: async ({ canvasElement }) => {
    const radius = (name: string) =>
      getComputedStyle(canvasElement.querySelector(`[data-radius="${name}"]`) as Element)
        .borderTopLeftRadius
    await expect(radius('rounded-media')).toBe('6px')
    await expect(radius('rounded-field')).toBe('10px')
    await expect(radius('rounded-panel')).toBe('14px')
    await expect(radius('rounded-dialog')).toBe('20px')
    // Pills: the full radius is larger than any control's half-height.
    await expect(Number.parseFloat(radius('rounded-full'))).toBeGreaterThan(44)
  },
}

function Motion() {
  const [moved, setMoved] = useState(false)
  const durations = useLive(readDurations) ?? []
  return (
    <Section title="Motion">
      <table className="max-w-md text-body-sm">
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
        <span className="relative h-10 w-64 rounded-media bg-panel">
          <span
            className="absolute top-1 left-1 size-8 rounded-media bg-primary transition-transform duration-(--duration-slow) ease-standard"
            style={{ transform: moved ? 'translateX(13rem)' : 'none' }}
          />
        </span>
      </div>
      <MotionSamples />
    </Section>
  )
}

/** Keyed on `run` so "Replay" restarts every one-shot animation. */
function MotionSamples() {
  const [run, setRun] = useState(0)
  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" className="w-fit" onClick={() => setRun(run + 1)}>
        Replay
      </Button>
      <div key={run} className="flex flex-wrap items-start gap-6">
        <div
          data-sample="rise-in"
          className="w-40 animate-rise-in rounded-panel bg-raised p-4 shadow-none"
        >
          <code className="text-caption">animate-rise-in</code>
        </div>
        <div
          data-sample="pop-in"
          className="w-40 animate-pop-in rounded-panel bg-raised p-4 shadow-none"
        >
          <code className="text-caption">animate-pop-in</code>
        </div>
        <div className="flex w-40 items-center gap-3 rounded-panel bg-raised p-4 shadow-none">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-8 shrink-0 fill-none stroke-success stroke-2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path
              data-sample="check-draw"
              d="m8 12.5 3 3 5-6"
              pathLength={1}
              strokeDasharray={1}
              className="animate-check-draw"
            />
          </svg>
          <code className="text-caption">animate-check-draw</code>
        </div>
        <ul className="stagger-children m-0 flex w-48 list-none flex-col gap-2 p-0">
          {['Position', 'Loop and speed', 'Helpers'].map((label, index) => (
            <li
              key={label}
              data-sample="stagger"
              className="animate-rise-in rounded-panel bg-raised px-3 py-2 text-body-sm shadow-none"
              style={{ '--i': index } as React.CSSProperties}
            >
              {label}
            </li>
          ))}
        </ul>
        <div className="flex w-64 flex-col gap-2">
          <span className="relative h-2 overflow-hidden rounded-full bg-panel">
            <span className="absolute inset-y-0 left-0 w-2/5 animate-progress-indeterminate rounded-full bg-primary" />
          </span>
          <code className="text-caption">animate-progress-indeterminate</code>
        </div>
      </div>
    </div>
  )
}

export const MotionTokens: Story = { render: Motion }
export const MotionReduced: Story = {
  render: Motion,
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    for (const token of MOTION_TOKENS) {
      await waitFor(() =>
        expect(canvasElement.querySelector(`[data-duration="${token}"]`)).toHaveTextContent('0ms'),
      )
    }
    // Zero durations show the final frame, and the stagger no longer delays any sibling.
    for (const sample of canvasElement.querySelectorAll<HTMLElement>('[data-sample="stagger"]')) {
      await expect(getComputedStyle(sample).animationDelay).toBe('0s')
      await expect(getComputedStyle(sample).opacity).toBe('1')
    }
  },
}
export const MotionStagger: Story = {
  render: Motion,
  play: async ({ canvasElement }) => {
    const delays = [...canvasElement.querySelectorAll<HTMLElement>('[data-sample="stagger"]')].map(
      (sample) => getComputedStyle(sample).animationDelay,
    )
    await expect(delays).toEqual(['0s', '0.04s', '0.08s'])
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
    <Section title="Icons (Lucide 24 px grid, 1.8 px stroke)">
      {[
        ['Transport set', TRANSPORT],
        ['Custom music icons', CUSTOM_ICONS],
      ].map(([title, set]) => (
        <div key={title as string} className="flex flex-col gap-3">
          <h3 className="text-title">{title as string}</h3>
          <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3 p-0">
            {Object.entries(set as Record<string, typeof PlayIcon>).map(([name, Icon]) => (
              <li
                key={name}
                className="flex items-center gap-3 rounded-media border border-border p-3 text-body-sm"
              >
                <Icon aria-hidden className="size-6 shrink-0 stroke-[1.8]" />
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

/**
 * Stage is Dark's colours with every reading size one step up: it raises Desk to Music stand and
 * then scales by 1.25, so the same page and ink as Dark with 45 px tab digits.
 */
export const StageAppearance: Story = {
  render: ReadingSizes,
  globals: { appearance: 'stage', distance: 'desk' },
  play: async ({ canvasElement }) => {
    await expect(readToken('--read-scale')).toBe('1.25')
    await expect(readColor('--background')).toBe(readColor('--gray-1'))
    // The page is Dark's step 1: a dark ground with light ink.
    await expect(new Color(readColor('--background')).to('oklch').l ?? 1).toBeLessThan(0.3)
    await expect(document.documentElement).toHaveAttribute('data-distance', 'stand')
    await expect(getComputedStyle(within(canvasElement).getByTestId('read-tab')).fontSize).toBe(
      '45px',
    )
  },
}
