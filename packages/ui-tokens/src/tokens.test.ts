// Token structure (docs/implementation/28-ui-quality-and-design-review.md §3): every role exists in
// every appearance, tiers only point downwards, and the no-JS fallbacks match the attribute paths.
import { describe, expect, it } from 'vitest'
import { ALIAS_ROLES, COMPONENT_TOKENS, READING_TOKENS, SEMANTIC_ROLES } from './index.ts'
import { CONTEXTS, loadRules, parseRules, readSource, tokensFor } from './testing/cascade.ts'

const primitives = parseRules(readSource('primitives.css'))
const themes = parseRules(readSource('themes.css'))
const rules = loadRules()

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
