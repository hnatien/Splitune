// Token structure (docs/specs/28-ui-quality-and-design-review.md §3): every role exists in
// every appearance, tiers only point downwards, Night is the page without an appearance, subtrees
// theme themselves, and the static scales are doc 26's.

import Color from 'colorjs.io'
import { describe, expect, it } from 'vitest'
import {
  ALIAS_ROLES,
  BACKGROUND_HEX,
  COMPONENT_TOKENS,
  MOTION_TOKENS,
  READING_TOKENS,
  SEMANTIC_ROLES,
  TARGET_TOKENS,
} from './index.ts'
import { CONTEXTS, loadRules, parseRules, readSource, tokensFor } from './testing/cascade.ts'

const primitives = parseRules(readSource('primitives.css'))
const themes = parseRules(readSource('themes.css'))
const rules = loadRules()
const tailwind = parseRules(readSource('theme.tailwind.css'))

const PRIMITIVE_NAMES = new Set(primitives.flatMap((rule) => rule.decls.map(([name]) => name)))
const SEMANTIC = new Set<string>([...SEMANTIC_ROLES, ...ALIAS_ROLES])
const COMPONENT = new Set<string>(COMPONENT_TOKENS)
const ALL = [...SEMANTIC_ROLES, ...ALIAS_ROLES, ...COMPONENT_TOKENS, ...READING_TOKENS]

const block = (selector: string, media: string | null = null) => {
  const rule = themes.find((r) => r.media === media && r.selectors.includes(selector))
  if (!rule) throw new Error(`No rule for ${selector} ${media ?? ''}`)
  return new Map(rule.decls)
}
const themeBlocks = {
  night: block('[data-appearance="dark"]'),
  daylight: block('[data-appearance="light"]'),
}
// "No shadow" that still composes into a box-shadow list with rings (themes.css header).
const NO_SHADOW = '0 0 0 0 transparent'
const references = (value: string) =>
  [...value.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1] as string)
const at = (attrs: Record<string, string>, subtree?: Record<string, string>) =>
  tokensFor(rules, subtree ? { attrs, subtree } : { attrs })
const same = (a: ReturnType<typeof tokensFor>, b: ReturnType<typeof tokensFor>) => {
  for (const name of ALL) expect([name, a.raw(name)]).toEqual([name, b.raw(name)])
}

describe('primitives (§3)', () => {
  const LITERAL = /^oklch\((\d(?:\.\d{1,3})?) (\d(?:\.\d{1,3})?) (\d{1,3})(?: \/ (0?\.\d+))?\)$/

  it('are OKLCH literals: L and C to three decimals, H in whole degrees', () => {
    for (const rule of primitives) {
      for (const [name, value] of rule.decls) {
        expect([name, value]).toEqual([name, expect.stringMatching(LITERAL)])
      }
    }
  })

  it('are inside sRGB as written', () => {
    for (const [name, value] of primitives.flatMap((rule) => rule.decls)) {
      expect([name, new Color(value).inGamut('srgb')]).toEqual([name, true])
    }
  })

  it('are only read by semantic roles', () => {
    for (const rule of [...themes, ...tailwind]) {
      for (const [name, value] of rule.decls) {
        if (SEMANTIC.has(name)) continue
        for (const ref of references(value)) {
          expect([name, ref, PRIMITIVE_NAMES.has(ref)]).toEqual([name, ref, false])
        }
      }
    }
  })
})

describe.each(Object.entries(themeBlocks))('%s block', (_, decls) => {
  it('defines every semantic role and component token, and nothing else', () => {
    const expected = [...SEMANTIC_ROLES, ...COMPONENT_TOKENS].sort()
    expect([...decls.keys()].filter((name) => name.startsWith('--')).sort()).toEqual(expected)
  })

  it('semantic roles point at primitives or other roles', () => {
    for (const name of SEMANTIC_ROLES) {
      for (const ref of references(decls.get(name) ?? '')) {
        expect([name, ref]).toEqual([
          name,
          expect.toSatisfy((r: string) => PRIMITIVE_NAMES.has(r) || SEMANTIC.has(r)),
        ])
      }
    }
  })

  it('component tokens never point at a primitive', () => {
    for (const name of COMPONENT_TOKENS) {
      for (const ref of references(decls.get(name) ?? '')) {
        expect([name, ref]).toEqual([
          name,
          expect.toSatisfy((r: string) => SEMANTIC.has(r) || COMPONENT.has(r)),
        ])
      }
    }
  })

  it('maps the shared surfaces and neutral statuses (§4.1, §4.3, §4.8)', () => {
    const roles = [
      '--surface-raised',
      '--surface-sunken',
      '--paper',
      '--ink',
      '--warning',
      '--warning-surface',
      '--info',
      '--info-surface',
      '--edited',
      '--conf-medium',
      '--conf-medium-edge',
      '--conf-low',
    ]
    expect(Object.fromEntries(roles.map((role) => [role, decls.get(role)]))).toEqual({
      '--surface-raised': 'var(--card)',
      '--surface-sunken': 'var(--background)',
      '--paper': 'var(--background)',
      '--ink': 'var(--foreground)',
      '--warning': 'var(--muted-foreground)',
      '--warning-surface': 'var(--accent)',
      '--info': 'var(--muted-foreground)',
      '--info-surface': 'var(--card)',
      '--edited': 'var(--success)',
      '--conf-medium': 'var(--ink)',
      '--conf-medium-edge': 'var(--faint-foreground)',
      '--conf-low': 'var(--unsure)',
    })
  })

  it('--scrim is the translucent graphite of the mockup overlay (§4.7)', () => {
    expect(decls.get('--scrim')).toBe('oklch(0.1 0.01 60 / 0.62)')
  })
})

describe('appearance blocks (§2)', () => {
  it('Night is :root, dark and stage; stage only raises the reading scale', () => {
    const night = themes.find((rule) => rule.selectors.includes('[data-appearance="dark"]'))
    expect(night?.selectors).toEqual([
      ':root',
      '[data-appearance="dark"]',
      '[data-appearance="stage"]',
    ])
    const stage = themes.filter(
      (rule) => rule.selectors.length === 1 && rule.selectors[0] === '[data-appearance="stage"]',
    )
    expect(stage.map((rule) => rule.decls)).toEqual([[['--read-scale', '1.25']]])
  })

  it('has no score surface and no colour-scheme media fallback', () => {
    const css = readSource('themes.css')
    expect(css).not.toMatch(/data-score/)
    expect(themes.some((rule) => rule.media?.includes('prefers-color-scheme'))).toBe(false)
  })

  it.each([
    ['dark', 'dark'],
    ['stage', 'dark'],
    ['light', 'light'],
  ])('%s sets color-scheme %s', (appearance, scheme) => {
    expect(at({ 'data-appearance': appearance }).raw('color-scheme')).toBe(scheme)
  })
})

describe('forced colours', () => {
  const forced = new Map(themes.find((rule) => rule.media === '(forced-colors: active)')?.decls)
  it('maps every surface and wash to Canvas, the scrim to transparent and drops the glow', () => {
    for (const role of [
      '--surface-raised',
      '--surface-sunken',
      '--success-surface',
      '--warning-surface',
      '--info-surface',
      '--destructive-surface',
      '--unsure-surface',
      '--primary-soft',
      '--bar-current',
      '--loop-fill',
      '--score-loop-fill',
    ]) {
      expect([role, forced.get(role)]).toEqual([role, 'Canvas'])
    }
    expect(forced.get('--scrim')).toBe('transparent')
    expect(forced.get('--glow')).toBe(NO_SHADOW)
  })
})

describe('elevation (§4.7, §9)', () => {
  const layers = (value: string | undefined) => (value ?? '').split(/,(?![^(]*\))/).length
  it.each(Object.entries(themeBlocks))('%s: cards are bordered, floating layers lifted', (_, d) => {
    expect(d.get('--elevation-1')).toBe(NO_SHADOW)
    for (const level of ['--elevation-2', '--elevation-3']) {
      expect([level, layers(d.get(level))]).toEqual([level, 2])
    }
  })

  it('Night adds a 1 px inset top highlight; Daylight has none', () => {
    for (const level of ['--elevation-2', '--elevation-3']) {
      expect(themeBlocks.night.get(level)).toMatch(/^0 1px 0 oklch\(1 0 0 \/ 0\.04\) inset, /)
      expect(themeBlocks.daylight.get(level)).not.toContain('inset')
    }
  })

  it('--glow is the amber halo of §4.2, dropped under increased contrast', () => {
    expect(at({ 'data-appearance': 'dark' }).raw('--glow')).toBe(
      '0 0 0 1px oklch(0.8 0.15 72 / 0.5), 0 0 24px oklch(0.8 0.15 72 / 0.3)',
    )
    expect(at({ 'data-appearance': 'light' }).raw('--glow')).toBe(
      '0 0 0 1px oklch(0.61 0.14 62), 0 0 18px oklch(0.8 0.15 72 / 0.35)',
    )
    for (const appearance of ['dark', 'light', 'stage']) {
      expect(at({ 'data-appearance': appearance, 'data-contrast': 'more' }).raw('--glow')).toBe(
        NO_SHADOW,
      )
    }
  })

  it('the segmented capsule and Play have their own shadows; Play drops its haze under increased contrast', () => {
    for (const appearance of ['dark', 'light', 'stage']) {
      expect(at({ 'data-appearance': appearance }).raw('--elevation-capsule')).toBe(
        '0 1px 2px oklch(0 0 0 / 0.25)',
      )
      expect(at({ 'data-appearance': appearance }).raw('--elevation-play')).toBe(
        '0 6px 20px oklch(0.8 0.15 72 / 0.28)',
      )
      expect(
        at({ 'data-appearance': appearance, 'data-contrast': 'more' }).raw('--elevation-play'),
      ).toBe(NO_SHADOW)
    }
  })
})

describe('motion (§10)', () => {
  const value = (decls: [string, string][] | undefined, name: string) =>
    decls?.find(([n]) => n === name)?.[1]
  const staticScale = tailwind.find(
    (rule) =>
      rule.selectors.includes(':root') && rule.selectors.length === 1 && rule.media === null,
  )
  const explicit = tailwind.find((rule) => rule.selectors.includes('[data-motion="reduce"]'))
  const system = tailwind.find(
    (rule) =>
      rule.media === '(prefers-reduced-motion: reduce)' &&
      rule.selectors.includes(':root:not([data-motion])'),
  )

  it('defines the static scale', () => {
    expect(MOTION_TOKENS.map((name) => value(staticScale?.decls, name))).toEqual([
      '100ms',
      '200ms',
      '300ms',
      '400ms',
      '40ms',
    ])
  })

  it.each([
    ['Settings (data-motion="reduce")', explicit],
    ['the OS preference without a stored choice', system],
  ])('zeroes every duration and the stagger for %s', (_, rule) => {
    for (const name of MOTION_TOKENS)
      expect([name, value(rule?.decls, name)]).toEqual([name, '0ms'])
  })

  it('exposes the keyframe utilities from @theme', () => {
    const css = readSource('theme.tailwind.css')
    for (const name of ['rise-in', 'pop-in', 'check-draw', 'shimmer', 'progress-indeterminate']) {
      expect(css).toMatch(new RegExp(`--animate-${name}: ${name} `))
      expect(css).toMatch(new RegExp(`@keyframes ${name} \\{`))
    }
    expect(css).toContain('--ease-standard: cubic-bezier(0.2, 0, 0, 1)')
    expect(css).toContain('--ease-enter: cubic-bezier(0, 0, 0, 1)')
    expect(css).toContain('--ease-exit: cubic-bezier(0.3, 0, 1, 1)')
    expect(css).toContain('--ease-spring: cubic-bezier(0.34, 1.3, 0.64, 1)')
    // The springs start at rest and settle exactly on the end value.
    for (const name of ['smooth', 'snappy'])
      expect(css).toMatch(new RegExp(`--ease-${name}: linear\\(\\s*0,[\\d.,\\s]+,\\s*1\\s*\\);`))
  })
})

describe('fallbacks without JS (§2)', () => {
  it('no attributes resolve to Night Rehearsal', () => {
    same(at({}), at({ 'data-appearance': 'dark' }))
  })

  it('a dark OS preference changes nothing before the head script runs', () => {
    same(
      tokensFor(rules, { attrs: {}, media: { prefersDark: true } }),
      at({ 'data-appearance': 'dark' }),
    )
  })

  it('an increased-contrast OS preference resolves to the "more" values', () => {
    same(
      tokensFor(rules, { attrs: {}, media: { prefersMoreContrast: true } }),
      at({ 'data-appearance': 'dark', 'data-contrast': 'more' }),
    )
  })

  it('a stored choice beats the OS preference', () => {
    same(
      tokensFor(rules, {
        attrs: { 'data-appearance': 'light', 'data-contrast': 'normal' },
        media: { prefersDark: true, prefersMoreContrast: true },
      }),
      at({ 'data-appearance': 'light', 'data-contrast': 'normal' }),
    )
  })
})

describe('subtree theming (§2)', () => {
  it.each(CONTEXTS)('a $name subtree matches the page in that context', ({ context }) => {
    const { 'data-appearance': appearance = 'dark', 'data-contrast': contrastMode = 'normal' } =
      context.attrs
    const other = appearance === 'light' ? 'dark' : 'light'
    same(
      at(
        { 'data-appearance': other, 'data-contrast': contrastMode },
        { 'data-appearance': appearance },
      ),
      at(context.attrs),
    )
  })

  it('increased contrast from the OS reaches a subtree too', () => {
    same(
      tokensFor(rules, {
        attrs: {},
        media: { prefersMoreContrast: true },
        subtree: { 'data-appearance': 'light' },
      }),
      at({ 'data-appearance': 'light', 'data-contrast': 'more' }),
    )
  })
})

describe('increased contrast (§2, §4.1, §4.7)', () => {
  it.each(['light', 'dark', 'stage'])(
    '%s: strengthens text, lines and boundaries, the HUD and the focus ring',
    (appearance) => {
      const normal = at({ 'data-appearance': appearance })
      const more = at({ 'data-appearance': appearance, 'data-contrast': 'more' })
      for (const name of [
        '--muted-foreground',
        '--faint-foreground',
        '--border',
        '--border-strong',
        '--input',
        '--staff',
        '--waveform-peak',
      ]) {
        expect([name, more.raw(name) !== normal.raw(name)]).toEqual([name, true])
        expect([name, more.raw(name)]).toEqual([name, more.raw(`${name}-more`)])
      }
      expect(more.color('--hud-bg').alpha).toBe(1)
      expect([normal.raw('--focus-width'), more.raw('--focus-width')]).toEqual(['2px', '3px'])
    },
  )
})

describe('reading sizes (§6.3)', () => {
  const size = (attrs: Record<string, string>, name: string) => at(attrs).raw(name)
  // rem at 16 px: Desk / Music stand / Floor.
  const PRESETS = {
    desk: {
      '--read-tab-base': '1.5rem',
      '--read-chord-base': '1.6875rem',
      '--read-chord-sheet-base': '1.875rem',
      '--read-chord-current-base': '7rem',
      '--read-chord-next-base': '3.5rem',
      '--read-bar-number-base': '0.875rem',
      '--read-readout-base': '1.375rem',
      '--read-label-base': '0.875rem',
    },
    stand: {
      '--read-tab-base': '2.25rem',
      '--read-chord-base': '2.5rem',
      '--read-chord-sheet-base': '2.75rem',
      '--read-chord-current-base': '9.375rem',
      '--read-chord-next-base': '4rem',
      '--read-bar-number-base': '1.25rem',
      '--read-readout-base': '1.75rem',
      '--read-label-base': '1.25rem',
    },
    floor: {
      '--read-tab-base': '3.375rem',
      '--read-chord-base': '4.9375rem',
      '--read-chord-sheet-base': '5.5rem',
      '--read-chord-current-base': '12.5rem',
      '--read-chord-next-base': '6.25rem',
      '--read-bar-number-base': '2.5rem',
      '--read-readout-base': '2.5rem',
      '--read-label-base': '1.5rem',
    },
  } satisfies Record<string, Record<string, string>>
  it.each(Object.entries(PRESETS))('%s has the §6.3 values', (distance, values) => {
    for (const [name, value] of Object.entries(values)) {
      expect([name, size({ 'data-distance': distance }, name)]).toEqual([name, value])
    }
  })

  it('without a stored distance the page reads at Desk', () => {
    for (const [name, value] of Object.entries(PRESETS.desk)) {
      expect([name, size({}, name)]).toEqual([name, value])
    }
  })

  it('never goes below the floors', () => {
    const px = (distance: string, name: string) =>
      Number.parseFloat(size({ 'data-distance': distance }, name)) * 16
    expect(px('stand', '--read-tab-base')).toBeGreaterThanOrEqual(36)
    expect(px('desk', '--read-chord-current-base')).toBeGreaterThanOrEqual(32)
    expect(px('floor', '--read-chord-current-base')).toBeGreaterThanOrEqual(88)
    expect(size({ 'data-distance': 'desk' }, '--read-tab')).toMatch(/^max\(1\.125rem, /)
  })

  it('Stage adds one step and calibration scales', () => {
    expect(size({ 'data-appearance': 'stage' }, '--read-scale')).toBe('1.25')
    expect(size({ 'data-distance': 'stand' }, '--read-tab')).toBe(
      'max(1.125rem, calc(2.25rem * calc(1 * 1)))',
    )
    expect(size({ 'data-appearance': 'stage', 'data-distance': 'stand' }, '--read-tab')).toBe(
      'max(1.125rem, calc(2.25rem * calc(1.25 * 1)))',
    )
  })
})

describe('static scales', () => {
  const css = readSource('theme.tailwind.css')
  const theme = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim()

  it('targets (§8)', () => {
    const scale = tailwind.find(
      (rule) => rule.selectors.length === 1 && rule.selectors[0] === ':root' && rule.media === null,
    )
    const decls = new Map(scale?.decls)
    expect(TARGET_TOKENS.map((name) => decls.get(name))).toEqual([
      '24px',
      '32px',
      '44px',
      '48px',
      '64px',
      '88px',
    ])
  })

  it('radius steps around the 10 px base (§9)', () => {
    const radius = (name: string) => {
      const value = theme(`--radius-${name}`) ?? ''
      const m = /^calc\(var\(--radius\) ([+-]) (\d+)px\)$/.exec(value)
      if (value === 'var(--radius)') return 10
      if (!m) throw new Error(`--radius-${name}: ${value}`)
      return 10 + (m[1] === '+' ? 1 : -1) * Number(m[2])
    }
    expect(theme('--radius')).toBe('0.625rem')
    expect(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'].map(radius)).toEqual([
      4, 6, 8, 10, 12, 14, 16, 22, 24,
    ])
  })

  it('browse type scale (§6.2), px at 16 / line height px / weight', () => {
    const rem = (value: string | undefined) => Number.parseFloat(value ?? 'NaN') * 16
    const STEPS: [string, number, number, number | undefined][] = [
      ['2xs', 11, 14, 650],
      ['xs', 12, 16, 650],
      ['sm', 13, 18, undefined],
      ['md', 14, 20, 600],
      ['button-lg', 16, 22, 600],
      ['base', 15, 22, 400],
      ['lg', 17, 22, 650],
      ['xl', 22, 26, 650],
      ['2xl', 32, 37, 650],
      ['3xl', 44, 46, 600],
      ['4xl', 48, 50, 600],
      ['5xl', 56, 59, 600],
    ]
    for (const [step, px, line, weight] of STEPS) {
      const weightValue = theme(`--text-${step}--font-weight`)
      expect([
        step,
        rem(theme(`--text-${step}`)),
        rem(theme(`--text-${step}--line-height`)),
        weightValue === undefined ? undefined : Number(weightValue),
      ]).toEqual([step, px, line, weight])
    }
    expect(theme('--text-display')).toBe('clamp(2.75rem, 6vw, 4.75rem)')
  })

  it('families (§6.1)', () => {
    const family = (name: string) => theme(`--font-${name}`)?.replace(/\s+/g, ' ')
    expect(family('sans')).toBe(
      '"Instrument Sans", "Instrument Sans Fallback", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
    )
    expect(family('display')).toBe(family('sans'))
    expect(family('mono')).toBe(
      '"JetBrains Mono", "JetBrains Mono Fallback", ui-monospace, "Cascadia Mono", Consolas, monospace',
    )
  })
})

describe('BACKGROUND_HEX (§11)', () => {
  it.each(['light', 'dark'] as const)('is the %s --background in sRGB hex', (appearance) => {
    const tokens = at({ 'data-appearance': appearance, 'data-contrast': 'normal' })
    const hex = new Color(tokens.raw('--background')).to('srgb').toString({ format: 'hex' })
    expect(BACKGROUND_HEX[appearance]).toBe(hex)
  })
})
