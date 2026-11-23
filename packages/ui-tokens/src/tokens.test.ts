// Token structure (docs/specs/28-ui-quality-and-design-review.md §3): every role exists in
// every appearance, tiers only point downwards, Dark is the page without an appearance, subtrees
// theme themselves, and the static scales are doc 26's.

import Color from 'colorjs.io'
import { describe, expect, it } from 'vitest'
import {
  ALIAS_ROLES,
  BACKGROUND_HEX,
  COMPONENT_TOKENS,
  MOTION_TOKENS,
  RAMP_STEPS,
  READING_TOKENS,
  ROLE_STEPS,
  SEMANTIC_ROLES,
  TARGET_TOKENS,
} from './index.ts'
import { CONTEXTS, loadRules, parseRules, readSource, tokensFor } from './testing/cascade.ts'

const primitives = parseRules(readSource('primitives.css'))
const themes = parseRules(readSource('themes.css'))
const rules = loadRules()
const tailwind = parseRules(readSource('theme.tailwind.css'))

const PRIMITIVE_NAMES = new Set(primitives.flatMap((rule) => rule.decls.map(([name]) => name)))
const SEMANTIC = new Set<string>([...RAMP_STEPS, ...SEMANTIC_ROLES, ...ALIAS_ROLES])
const COMPONENT = new Set<string>(COMPONENT_TOKENS)
const ALL = [
  ...RAMP_STEPS,
  ...SEMANTIC_ROLES,
  ...ALIAS_ROLES,
  ...COMPONENT_TOKENS,
  ...READING_TOKENS,
]

const block = (selector: string, media: string | null = null) => {
  const rule = themes.find((r) => r.media === media && r.selectors.includes(selector))
  if (!rule) throw new Error(`No rule for ${selector} ${media ?? ''}`)
  return new Map(rule.decls)
}
const themeBlocks = {
  dark: block('[data-appearance="dark"]'),
  light: block('[data-appearance="light"]'),
}
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

describe.each(Object.entries(themeBlocks))('%s block', (appearance, decls) => {
  it('defines the ramp, every semantic role and component token, and nothing else', () => {
    const expected = [...RAMP_STEPS, ...SEMANTIC_ROLES, ...COMPONENT_TOKENS].sort()
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

  it('binds the ramp to its own twelve primitives, in order (§4.1)', () => {
    expect(RAMP_STEPS.map((step) => decls.get(step))).toEqual(
      RAMP_STEPS.map((_, i) => `var(--${appearance}-${i + 1})`),
    )
  })

  it('reads every ramp-backed role from the step that has its job (§4.1)', () => {
    expect(
      Object.fromEntries(Object.keys(ROLE_STEPS).map((role) => [role, decls.get(role)])),
    ).toEqual(
      Object.fromEntries(
        Object.entries(ROLE_STEPS).map(([role, step]) => [role, `var(--gray-${step})`]),
      ),
    )
  })

  it('increased contrast is one ramp step further from the ground (§2)', () => {
    for (const role of [
      '--border',
      '--border-strong',
      '--edge',
      '--faint-foreground',
      '--muted-foreground',
    ] as const) {
      expect([role, ROLE_STEPS[`${role}-more`]]).toEqual([role, ROLE_STEPS[role] + 1])
    }
  })

  it('maps the score and the confidence marks to the ink (§4.7, §5)', () => {
    const roles = {
      '--paper': 'var(--background)',
      '--ink': 'var(--foreground)',
      '--edited': 'var(--success)',
      '--conf-medium': 'var(--ink)',
      '--conf-medium-edge': 'var(--faint-foreground)',
      '--conf-low': 'var(--ink)',
      '--conf-low-edge': 'var(--unsure)',
      '--bar-current': 'var(--wash)',
      '--staff': 'var(--edge)',
      '--playhead': 'var(--signal)',
      '--loop-edge': 'var(--signal)',
    }
    expect(Object.fromEntries(Object.keys(roles).map((role) => [role, decls.get(role)]))).toEqual(
      roles,
    )
  })

  it('--scrim is translucent black (§4.7)', () => {
    expect(decls.get('--scrim')).toMatch(/^oklch\(0 0 0 \/ 0\.[57]\)$/)
  })
})

describe('neutral interface (§4.1)', () => {
  it('every surface, text and line role is achromatic in every context', () => {
    const NEUTRAL = [
      ...RAMP_STEPS,
      ...Object.keys(ROLE_STEPS),
      '--bar-current',
      '--loop-fill',
      '--score-loop-fill',
      '--staff',
      '--waveform-peak',
      '--hud-bg',
      '--scrim',
    ]
    for (const { context } of CONTEXTS) {
      const tokens = tokensFor(rules, context)
      for (const name of NEUTRAL) {
        expect([name, tokens.color(name).to('oklch').coords[1] ?? 0]).toEqual([name, 0])
      }
    }
  })
})

describe('appearance blocks (§2)', () => {
  it('Dark is :root, dark and stage; stage only raises the reading scale', () => {
    const dark = themes.find((rule) => rule.selectors.includes('[data-appearance="dark"]'))
    expect(dark?.selectors).toEqual([
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
  it('maps every surface and wash to Canvas, the state marks to Highlight and the scrim to transparent', () => {
    for (const role of [
      '--background',
      '--panel',
      '--raised',
      '--hover',
      '--wash',
      '--pressed',
      '--success-surface',
      '--destructive-surface',
      '--unsure-surface',
      '--bar-current',
      '--loop-fill',
      '--score-loop-fill',
      '--hud-bg',
    ]) {
      expect([role, forced.get(role)]).toEqual([role, 'Canvas'])
    }
    for (const role of ['--selected', '--signal', '--ring', '--primary']) {
      expect([role, forced.get(role)]).toEqual([role, 'Highlight'])
    }
    expect(forced.get('--scrim')).toBe('transparent')
  })
})

describe('elevation (§9)', () => {
  it('only popovers and dialogs cast a shadow: a close layer under a wide one, in black only', () => {
    expect(SEMANTIC_ROLES.filter((name) => name.startsWith('--elevation-'))).toEqual([
      '--elevation-popover',
      '--elevation-dialog',
    ])
    for (const d of Object.values(themeBlocks)) {
      for (const level of ['--elevation-popover', '--elevation-dialog']) {
        expect(d.get(level)).toMatch(
          /^0 2px 6px oklch\(0 0 0 \/ 0\.\d+\), 0 \d+px \d+px oklch\(0 0 0 \/ 0\.\d+\)$/,
        )
      }
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
    // Three curves only: entering decelerates, leaving accelerates, everything else is standard.
    expect([...css.matchAll(/--ease-([a-z]+):/g)].map((m) => m[1])).toEqual([
      'standard',
      'enter',
      'exit',
    ])
  })
})

describe('fallbacks without JS (§2)', () => {
  it('no attributes resolve to Dark', () => {
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
        '--edge',
        '--staff',
        '--waveform-peak',
      ]) {
        expect([name, more.raw(name) !== normal.raw(name)]).toEqual([name, true])
        expect([name, more.raw(name)]).toEqual([name, more.raw(`${name}-more`)])
      }
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
      '44px',
      '48px',
      '64px',
      '88px',
    ])
  })

  it('radii are named by what they round (§9)', () => {
    const px = (name: string) => Number.parseFloat(theme(`--radius-${name}`) ?? 'NaN') * 16
    expect(['media', 'field', 'panel', 'dialog'].map(px)).toEqual([6, 10, 14, 20])
    expect([...css.matchAll(/--radius-([a-z0-9]+):/g)].map((m) => m[1])).toEqual([
      'media',
      'field',
      'panel',
      'dialog',
    ])
  })

  it('type by role (§6.2), px at 16 / line height px / weight', () => {
    const rem = (value: string | undefined) => Number.parseFloat(value ?? 'NaN') * 16
    const STEPS: [string, number, number, number][] = [
      ['kbd', 11, 14, 500],
      ['caption', 12, 16, 400],
      ['label-sm', 13, 18, 500],
      ['body-sm', 13, 18, 400],
      ['label', 14, 20, 500],
      ['body', 15, 22, 400],
      ['field', 16, 22, 400],
      ['title', 17, 24, 500],
      ['lead', 17, 26, 400],
      ['heading', 22, 28, 500],
      ['readout', 28, 34, 500],
      ['display', 32, 38, 500],
    ]
    for (const [step, size, line, weight] of STEPS) {
      expect([
        step,
        rem(theme(`--text-${step}`)),
        rem(theme(`--text-${step}--line-height`)),
        Number(theme(`--text-${step}--font-weight`)),
      ]).toEqual([step, size, line, weight])
    }
    expect(theme('--text-hero')).toBe('clamp(2.5rem, 5vw, 3.5rem)')
    // Tracking tightens with size and never passes −0.03em.
    expect(
      ['body', 'field', 'title', 'lead', 'heading', 'readout', 'display', 'hero'].map((step) =>
        theme(`--text-${step}--letter-spacing`),
      ),
    ).toEqual([
      '-0.01em',
      '-0.01em',
      '-0.01em',
      '-0.01em',
      '-0.01em',
      '-0.02em',
      '-0.02em',
      '-0.03em',
    ])
  })

  it('nothing is set below 11 px and no size carries a weight other than 400 or 500 (§6.1)', () => {
    const sizes = [...css.matchAll(/--text-[a-z-]+: (\d*\.?\d+)rem;/g)].map(
      (m) => Number(m[1]) * 16,
    )
    expect(Math.min(...sizes)).toBe(11)
    const weights = [...css.matchAll(/--text-[a-z-]+--font-weight: (\d+);/g)].map((m) => m[1])
    expect([...new Set(weights)].sort()).toEqual(['400', '500'])
  })

  it('families (§6.1)', () => {
    const family = (name: string) => theme(`--font-${name}`)?.replace(/\s+/g, ' ')
    expect(family('sans')).toBe(
      '"Figtree", "Figtree Fallback", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
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
