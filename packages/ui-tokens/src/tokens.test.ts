// Token structure (docs/implementation/28-ui-quality-and-design-review.md §3): every role exists in
// every appearance, tiers only point downwards, and the no-JS fallbacks match the attribute paths.

import Color from 'colorjs.io'
import { describe, expect, it } from 'vitest'
import {
  ALIAS_ROLES,
  BACKGROUND_HEX,
  COMPONENT_TOKENS,
  MOTION_TOKENS,
  READING_TOKENS,
  SEMANTIC_ROLES,
} from './index.ts'
import { CONTEXTS, loadRules, parseRules, readSource, tokensFor } from './testing/cascade.ts'

const primitives = parseRules(readSource('primitives.css'))
const themes = parseRules(readSource('themes.css'))
const rules = loadRules()
const tailwind = parseRules(readSource('theme.tailwind.css'))

const PRIMITIVE_NAMES = new Set(primitives.flatMap((rule) => rule.decls.map(([name]) => name)))
const SEMANTIC = new Set<string>([...SEMANTIC_ROLES, ...ALIAS_ROLES])
const COMPONENT = new Set<string>(COMPONENT_TOKENS)

const block = (selector: string, media: string | null = null) => {
  const rule = themes.find((r) => r.media === media && r.selectors.includes(selector))
  if (!rule) throw new Error(`No rule for ${selector} ${media ?? ''}`)
  return new Map(rule.decls)
}
const appearanceBlocks = {
  light: block('[data-appearance="light"]'),
  dark: block('[data-appearance="dark"]'),
  stage: block('[data-appearance="stage"]'),
}
const SURFACE_ROLES = [
  '--surface-raised',
  '--surface-sunken',
  '--success-surface',
  '--warning-surface',
  '--info-surface',
  '--destructive-surface',
]
const references = (value: string) =>
  [...value.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1] as string)

describe('primitives', () => {
  it('are literal OKLCH values in 12-step gray and indigo ramps', () => {
    for (const rule of primitives) {
      for (const [name, value] of rule.decls) {
        expect([name, value]).toEqual([
          name,
          expect.stringMatching(/^oklch\([\d.]+ [\d.]+ [\d.]+\)$/),
        ])
      }
    }
    for (const ramp of [
      'gray',
      'gray-dark',
      'gray-stage',
      'indigo',
      'indigo-dark',
      'indigo-stage',
    ]) {
      for (let step = 1; step <= 12; step++) expect(PRIMITIVE_NAMES).toContain(`--${ramp}-${step}`)
    }
  })

  const primitive = (name: string) => {
    const value = primitives.flatMap((rule) => rule.decls).find(([n]) => n === name)?.[1]
    if (!value) throw new Error(`No primitive ${name}`)
    return /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value)?.slice(1).map(Number) as [
      number,
      number,
      number,
    ]
  }

  describe.each(['red', 'green', 'amber', 'blue'])('%s status tint (§4.8)', (status) => {
    it.each([
      ['light', 0.03],
      ['dark', 0.05],
      ['stage', 0.04],
    ] as const)('%s keeps the hue of its status base at chroma %d', (appearance, chroma) => {
      const [, tintChroma, tintHue] = primitive(`--${status}-tint-${appearance}`)
      const [, , baseHue] = primitive(`--${status}-${appearance}`)
      expect([tintChroma, tintHue]).toEqual([chroma, baseHue])
    })
  })
})

describe.each(Object.entries(appearanceBlocks))('%s appearance', (_, decls) => {
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
})

describe('surfaces and status surfaces (§4.8)', () => {
  const EXPECTED = {
    light: ['gray-1', 'gray-3', 'light'],
    dark: ['gray-dark-3', 'gray-dark-2', 'dark'],
    stage: ['gray-stage-3', 'gray-stage-2', 'stage'],
  } as const

  it.each(Object.entries(EXPECTED))('%s maps raised, sunken and the four tints', (name, map) => {
    const [raised, sunken, tint] = map
    const decls = appearanceBlocks[name as keyof typeof appearanceBlocks]
    expect(Object.fromEntries(SURFACE_ROLES.map((role) => [role, decls.get(role)]))).toEqual({
      '--surface-raised': `var(--${raised})`,
      '--surface-sunken': `var(--${sunken})`,
      '--success-surface': `var(--green-tint-${tint})`,
      '--warning-surface': `var(--amber-tint-${tint})`,
      '--info-surface': `var(--blue-tint-${tint})`,
      '--destructive-surface': `var(--red-tint-${tint})`,
    })
  })

  it('--scrim is a translucent literal, dark in Light and black in Dark and Stage', () => {
    const scrim = (name: keyof typeof appearanceBlocks) => appearanceBlocks[name].get('--scrim')
    expect(scrim('light')).toBe('oklch(0.2 0.01 75 / 0.4)')
    expect(scrim('dark')).toBe('oklch(0 0 0 / 0.6)')
    expect(scrim('stage')).toBe('oklch(0 0 0 / 0.6)')
  })

  it('forced colours map every surface to Canvas and the scrim to transparent', () => {
    const forced = themes.find((rule) => rule.media === '(forced-colors: active)')
    const decls = new Map(forced?.decls)
    for (const role of SURFACE_ROLES) expect([role, decls.get(role)]).toEqual([role, 'Canvas'])
    expect(decls.get('--scrim')).toBe('transparent')
  })
})

describe('elevation (§9)', () => {
  const layers = (value: string | undefined) => (value ?? '').split(/,(?![^(]*\))/).length
  it.each(Object.entries(appearanceBlocks))('%s: two layers at every level', (_, decls) => {
    for (const level of ['--elevation-1', '--elevation-2', '--elevation-3']) {
      expect([level, layers(decls.get(level))]).toEqual([level, 2])
    }
  })

  it('Dark and Stage add a 1 px top highlight; Light has none', () => {
    const highlight = (name: 'dark' | 'stage') =>
      ['--elevation-1', '--elevation-2', '--elevation-3'].map(
        (level) =>
          /^inset 0 1px 0 0 oklch\(1 0 0 \/ ([\d.]+)\),/.exec(
            appearanceBlocks[name].get(level) ?? '',
          )?.[1],
      )
    expect(highlight('dark')).toEqual(['0.05', '0.05', '0.06'])
    expect(highlight('stage')).toEqual(['0.04', '0.04', '0.04'])
    expect(appearanceBlocks.light.get('--elevation-1')).not.toContain('inset')
  })
})

describe('motion (§10)', () => {
  const value = (decls: [string, string][] | undefined, name: string) =>
    decls?.find(([n]) => n === name)?.[1]
  const staticScale = tailwind.find(
    (rule) => rule.selectors.includes(':root') && rule.media === null,
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
    expect(css).toContain('--ease-spring: cubic-bezier(0.34, 1.3, 0.64, 1)')
  })
})

describe('fallbacks without JS', () => {
  it('the prefers-color-scheme block repeats the Dark block exactly', () => {
    expect(block(':root:not([data-appearance])', '(prefers-color-scheme: dark)')).toEqual(
      appearanceBlocks.dark,
    )
  })

  const ALL = [...SEMANTIC_ROLES, ...ALIAS_ROLES, ...COMPONENT_TOKENS, ...READING_TOKENS]
  const same = (a: ReturnType<typeof tokensFor>, b: ReturnType<typeof tokensFor>) => {
    for (const name of ALL) expect([name, a.raw(name)]).toEqual([name, b.raw(name)])
  }

  it('no attributes resolve to Light', () => {
    same(tokensFor(rules, { attrs: {} }), tokensFor(rules, CONTEXTS[0]?.context ?? { attrs: {} }))
  })

  it('a dark OS preference resolves to Dark', () => {
    same(
      tokensFor(rules, { attrs: {}, media: { prefersDark: true } }),
      tokensFor(rules, { attrs: { 'data-appearance': 'dark' } }),
    )
  })

  it('an increased-contrast OS preference resolves to the "more" values', () => {
    same(
      tokensFor(rules, { attrs: {}, media: { prefersDark: true, prefersMoreContrast: true } }),
      tokensFor(rules, { attrs: { 'data-appearance': 'dark', 'data-contrast': 'more' } }),
    )
  })

  it('a stored choice beats the OS preference', () => {
    same(
      tokensFor(rules, {
        attrs: { 'data-appearance': 'light', 'data-contrast': 'normal' },
        media: { prefersDark: true, prefersMoreContrast: true },
      }),
      tokensFor(rules, { attrs: { 'data-appearance': 'light', 'data-contrast': 'normal' } }),
    )
  })
})

describe('increased contrast', () => {
  it.each(['light', 'dark', 'stage'])(
    '%s: strengthens muted text, borders and the focus ring',
    (appearance) => {
      const normal = tokensFor(rules, { attrs: { 'data-appearance': appearance } })
      const more = tokensFor(rules, {
        attrs: { 'data-appearance': appearance, 'data-contrast': 'more' },
      })
      for (const name of ['--muted-foreground', '--border', '--input']) {
        expect(more.raw(name)).not.toBe(normal.raw(name))
      }
      expect(more.color('--hud-bg').alpha).toBe(1)
      expect([normal.raw('--focus-width'), more.raw('--focus-width')]).toEqual(['2px', '3px'])
    },
  )
})

describe('reading sizes (§6.3)', () => {
  const size = (attrs: Record<string, string>, name: string) =>
    tokensFor(rules, { attrs }).raw(name)
  it('follow the distance preset, Stage adds one step and calibration scales', () => {
    expect(size({ 'data-distance': 'stand' }, '--read-tab-base')).toBe('2.25rem')
    expect(size({ 'data-distance': 'desk' }, '--read-chord-current-base')).toBe('2rem')
    expect(size({ 'data-distance': 'floor' }, '--read-chord-current-base')).toBe('5.5rem')
    expect(size({ 'data-appearance': 'stage' }, '--read-scale')).toBe('1.25')
    expect(size({ 'data-distance': 'stand' }, '--read-tab')).toBe(
      'max(1.125rem, calc(2.25rem * calc(1 * 1)))',
    )
  })
})

describe('BACKGROUND_HEX', () => {
  it.each(['light', 'dark'] as const)('is the %s --background in sRGB hex', (appearance) => {
    const tokens = tokensFor(rules, {
      attrs: { 'data-appearance': appearance, 'data-contrast': 'normal' },
    })
    const hex = new Color(tokens.raw('--background')).to('srgb').toString({ format: 'hex' })
    expect(BACKGROUND_HEX[appearance]).toBe(hex)
  })
})
