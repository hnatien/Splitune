// WCAG 2.2 contrast and sRGB gamut of every semantic and component colour, in every appearance ×
// contrast context (docs/specs/26-design-system.md §4.6, 28-ui-quality-and-design-review.md §3).
import Color from 'colorjs.io'
import { describe, expect, it } from 'vitest'
import { COMPONENT_TOKENS, CONTRAST_PAIRS, RAMP_STEPS, SEMANTIC_ROLES } from './index.ts'
import { CONTEXTS, contrast, loadRules, over, tokensFor } from './testing/cascade.ts'

const rules = loadRules()

const NON_COLOURS = new Set(['--elevation-popover', '--elevation-dialog', '--read-scale'])
const COLOURS = [...RAMP_STEPS, ...SEMANTIC_ROLES, ...COMPONENT_TOKENS].filter(
  (name) => !NON_COLOURS.has(name),
)

describe.each(CONTEXTS)('$name', ({ context }) => {
  const tokens = tokensFor(rules, context)

  it.each(CONTRAST_PAIRS)('%s on %s ≥ %d:1', (fg, bg, min) => {
    expect(contrast(tokens.color(fg), tokens.color(bg))).toBeGreaterThanOrEqual(min)
  })

  it.each(COLOURS)('%s is inside sRGB', (name) => {
    expect(tokens.color(name).inGamut('srgb')).toBe(true)
  })

  it('only the scrim is translucent, so every surface and line is the colour it says (§4.3)', () => {
    for (const name of COLOURS) {
      expect([name, tokens.color(name).alpha < 1]).toEqual([name, name === '--scrim'])
    }
  })

  it('Notes digits read on the tinted note head over paper and the loop band', () => {
    // A sure note's head is the instrument's mark at 30 % over the paper (GuitarRoll, MelodyRoll).
    for (const mark of ['--fret-guitar', '--fret-bass', '--melody-vocals'] as const) {
      for (const under of ['--paper', '--score-loop-fill'] as const) {
        const tint = tokens.color(mark).clone()
        tint.alpha = 0.3
        const head = over(tint, tokens.color(under))
        expect([mark, under, contrast(tokens.color('--ink'), head) >= 4.5]).toEqual([
          mark,
          under,
          true,
        ])
      }
    }
  })
})

describe('selection is never a grey fill (§4.5)', () => {
  // The audit's failure: a "selected" surface 1.1–1.3:1 from its neighbours. No surface pair of
  // the ramp reaches 3:1, so a surface alone can never be the state; the ink edge or line that
  // marks it always does.
  const SURFACES = [
    '--background',
    '--panel',
    '--raised',
    '--hover',
    '--wash',
    '--pressed',
  ] as const
  it.each(CONTEXTS)('$name: surfaces differ by less than 3:1, the ink by more', ({ context }) => {
    const tokens = tokensFor(rules, context)
    for (const a of SURFACES) {
      for (const b of SURFACES) {
        expect([a, b, contrast(tokens.color(a), tokens.color(b)) < 3]).toEqual([a, b, true])
      }
      expect([a, contrast(tokens.color('--selected'), tokens.color(a)) >= 7]).toEqual([a, true])
    }
  })
})

describe('§4.6 documented values', () => {
  // The table in doc 26 §4.6 (one decimal, so ±0.1). A value change must update the doc too.
  const DARK: [string, string, number][] = [
    ['--foreground', '--background', 16.8],
    ['--foreground', '--raised', 15],
    ['--muted-foreground', '--background', 10.3],
    ['--faint-foreground', '--background', 6.7],
    ['--faint-foreground', '--hover', 5.5],
    ['--edge', '--background', 3.9],
    ['--edge', '--hover', 3.2],
    ['--border-strong', '--background', 2.1],
    ['--border', '--background', 1.5],
    ['--primary-foreground', '--primary', 16.8],
    ['--staff', '--paper', 3.9],
    ['--staff', '--bar-current', 3.2],
    ['--unsure', '--background', 7.7],
    ['--success', '--background', 9.1],
    ['--destructive', '--background', 6.7],
  ]
  const DOCUMENTED: Record<string, [string, string, number][]> = {
    dark: DARK,
    stage: DARK,
    light: [
      ['--foreground', '--background', 17.8],
      ['--foreground', '--raised', 18.5],
      ['--muted-foreground', '--background', 8.9],
      ['--faint-foreground', '--background', 5.3],
      ['--faint-foreground', '--hover', 4.7],
      ['--edge', '--background', 3.8],
      ['--edge', '--hover', 3.4],
      ['--border-strong', '--background', 1.6],
      ['--border', '--background', 1.2],
      ['--primary-foreground', '--primary', 17.8],
      ['--staff', '--paper', 3.8],
      ['--staff', '--bar-current', 3.4],
      ['--unsure', '--background', 5.9],
      ['--success', '--background', 6],
      ['--destructive', '--background', 5.3],
    ],
  }
  it.each(Object.entries(DOCUMENTED))('%s matches the documented ratios', (appearance, pairs) => {
    const tokens = tokensFor(rules, {
      attrs: { 'data-appearance': appearance, 'data-contrast': 'normal' },
    })
    for (const [fg, bg, ratio] of pairs) {
      const measured = contrast(tokens.color(fg), tokens.color(bg))
      expect([fg, bg, Math.round(measured * 10) / 10]).toEqual([fg, bg, ratio])
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
