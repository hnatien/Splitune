// WCAG 2.2 contrast and sRGB gamut of every semantic and component colour, in every appearance ×
// contrast context (docs/implementation/26-design-system.md §4.6, 28-ui-quality-and-design-review.md §3).
import Color from 'colorjs.io'
import { describe, expect, it } from 'vitest'
import { COMPONENT_TOKENS, CONTRAST_PAIRS, SEMANTIC_ROLES } from './index.ts'
import { CONTEXTS, contrast, loadRules, over, tokensFor } from './testing/cascade.ts'

const rules = loadRules()

const NON_COLOURS = new Set(['--elevation-1', '--elevation-2', '--elevation-3', '--read-scale'])

describe.each(CONTEXTS)('$name', ({ context }) => {
  const tokens = tokensFor(rules, context)

  it.each(CONTRAST_PAIRS)('%s on %s ≥ %d:1', (fg, bg, min) => {
    expect(contrast(tokens.color(fg), tokens.color(bg))).toBeGreaterThanOrEqual(min)
  })

  it('PedalHud text reads on its translucent backdrop over paper and background', () => {
    for (const under of ['--paper', '--background', '--card']) {
      const backdrop = over(tokens.color('--hud-bg'), tokens.color(under))
      expect(contrast(tokens.color('--hud-fg'), backdrop)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each([...SEMANTIC_ROLES, ...COMPONENT_TOKENS].filter((name) => !NON_COLOURS.has(name)))(
    '%s is inside sRGB',
    (name) => {
      expect(tokens.color(name).inGamut('srgb')).toBe(true)
    },
  )
})

describe('§4.6 baseline values', () => {
  // The table in doc 26 §4.6 (one decimal, so ±0.1). A value change must update the doc too.
  const BASELINE: Record<string, [string, string, number][]> = {
    light: [
      ['--foreground', '--background', 16.7],
      ['--muted-foreground', '--card', 6.7],
      ['--primary-foreground', '--primary', 7.0],
      ['--ring', '--background', 6.8],
      ['--input', '--card', 3.6],
      ['--ink', '--paper', 18.3],
      ['--conf-medium', '--paper', 10.6],
      ['--conf-low', '--paper', 6.9],
      ['--score-loop-edge', '--paper', 7.1],
      ['--score-playhead', '--paper', 5.2],
      ['--staff', '--paper', 3.8],
      ['--staff', '--score-loop-fill', 3.1],
    ],
    dark: [
      ['--foreground', '--background', 15.2],
      ['--muted-foreground', '--card', 6.7],
      ['--primary-foreground', '--primary', 8.0],
      ['--ring', '--background', 7.7],
      ['--input', '--card', 3.6],
      ['--ink', '--paper', 15.3],
      ['--conf-medium', '--paper', 8.9],
      ['--conf-low', '--paper', 6.1],
      ['--score-loop-edge', '--paper', 6.0],
      ['--score-playhead', '--paper', 4.4],
      ['--staff', '--paper', 3.8],
      ['--staff', '--score-loop-fill', 3.0],
    ],
    stage: [
      ['--foreground', '--background', 14.6],
      ['--muted-foreground', '--card', 8.2],
      ['--primary-foreground', '--primary', 7.8],
      ['--ring', '--background', 7.8],
      ['--input', '--card', 3.4],
      ['--ink', '--paper', 14.3],
      ['--conf-medium', '--paper', 9.6],
      ['--conf-low', '--paper', 7.2],
      ['--score-loop-edge', '--paper', 7.6],
      ['--score-playhead', '--paper', 6.3],
      ['--staff', '--paper', 4.1],
      ['--staff', '--score-loop-fill', 3.3],
    ],
  }
  it.each(Object.entries(BASELINE))('%s matches the documented ratios', (appearance, pairs) => {
    const tokens = tokensFor(rules, {
      attrs: { 'data-appearance': appearance, 'data-contrast': 'normal' },
    })
    for (const [fg, bg, ratio] of pairs) {
      const measured = contrast(tokens.color(fg), tokens.color(bg))
      expect([fg, bg, Math.abs(measured - ratio) <= 0.1]).toEqual([fg, bg, true])
    }
  })
})

describe('contrast helper', () => {
  it('composites translucent colours before measuring', () => {
    const half = new Color('black')
    half.alpha = 0.5
    expect(contrast(half, new Color('white'))).toBeCloseTo(3.98, 1)
  })
})
