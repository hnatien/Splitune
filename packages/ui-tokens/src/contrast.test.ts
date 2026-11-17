// WCAG 2.2 contrast and sRGB gamut of every semantic and component colour, in every appearance ×
// contrast context (docs/specs/26-design-system.md §4.6, 28-ui-quality-and-design-review.md §3).
import Color from 'colorjs.io'
import { describe, expect, it } from 'vitest'
import { COMPONENT_TOKENS, CONTRAST_PAIRS, SEMANTIC_ROLES } from './index.ts'
import { CONTEXTS, contrast, loadRules, over, type Tokens, tokensFor } from './testing/cascade.ts'

const rules = loadRules()

const NON_COLOURS = new Set([
  '--elevation-1',
  '--elevation-2',
  '--elevation-3',
  '--elevation-capsule',
  '--elevation-play',
  '--glow',
  '--read-scale',
])
const TRANSLUCENT = new Set(['--primary-soft', '--primary-line', '--scrim'])

describe.each(CONTEXTS)('$name', ({ context }) => {
  const tokens = tokensFor(rules, context)

  it.each(CONTRAST_PAIRS)('%s on %s ≥ %d:1', (fg, bg, min) => {
    expect(contrast(tokens.color(fg), tokens.color(bg))).toBeGreaterThanOrEqual(min)
  })

  it('every background in CONTRAST_PAIRS is opaque (§4.3)', () => {
    for (const bg of new Set(CONTRAST_PAIRS.map(([, background]) => background))) {
      expect([bg, tokens.color(bg).alpha]).toEqual([bg, 1])
    }
  })

  it.each([...SEMANTIC_ROLES, ...COMPONENT_TOKENS].filter((name) => !NON_COLOURS.has(name)))(
    '%s is inside sRGB',
    (name) => {
      expect(tokens.color(name).inGamut('srgb')).toBe(true)
    },
  )

  it('only the ink wash, its hairline and the scrim are translucent', () => {
    for (const name of [...SEMANTIC_ROLES, ...COMPONENT_TOKENS].filter(
      (n) => !NON_COLOURS.has(n),
    )) {
      if (tokens.color(name).alpha < 1) expect([name, TRANSLUCENT.has(name)]).toEqual([name, true])
    }
  })
})

/** `fg` on the translucent `wash` composited over `under`. */
const onWash = (tokens: Tokens, fg: string, wash: string, under: string) =>
  contrast(tokens.color(fg), over(tokens.color(wash), tokens.color(under)))

describe('translucent washes (§4.6)', () => {
  describe.each(CONTEXTS)('$name', ({ context }) => {
    const tokens = tokensFor(rules, context)

    it.each(['--background', '--card', '--muted'])(
      '--primary-ink on --primary-soft over %s ≥ 4.5:1',
      (under) => {
        expect(onWash(tokens, '--primary-ink', '--primary-soft', under)).toBeGreaterThanOrEqual(4.5)
      },
    )

    it('--foreground on --primary-soft over --card ≥ 4.5:1', () => {
      expect(onWash(tokens, '--foreground', '--primary-soft', '--card')).toBeGreaterThanOrEqual(4.5)
    })

    it('Notes digits read on the tinted note head over paper and the loop band', () => {
      // A sure note's head is the instrument's mark at 30 % over the paper (GuitarRoll, MelodyRoll).
      for (const mark of ['--fret-guitar', '--fret-bass', '--melody-vocals'] as const) {
        for (const under of ['--paper', '--score-loop-fill'] as const) {
          const tint = tokens.color(mark).clone()
          tint.alpha = 0.3
          const head = over(tint, tokens.color('--paper'))
          expect(contrast(tokens.color('--ink'), head)).toBeGreaterThanOrEqual(4.5)
          expect(contrast(tokens.color('--ink'), tokens.color(under))).toBeGreaterThanOrEqual(4.5)
        }
      }
    })

    it('PedalHud text reads on its backdrop over paper, background and card', () => {
      for (const under of ['--paper', '--background', '--card']) {
        const backdrop = over(tokens.color('--hud-bg'), tokens.color(under))
        expect(contrast(tokens.color('--hud-fg'), backdrop)).toBeGreaterThanOrEqual(4.5)
      }
    })
  })

  // The table in doc 26 §4.6 (one decimal, so ±0.1; the note-head row is a lower bound).
  const WASHES = {
    dark: { ink: [16.6, 13.5, 11.4], foreground: 13.5, head: 12.6 },
    light: { ink: [16.4, 16.4, 15.1], foreground: 16.4, head: 12.4 },
  }
  it.each(Object.entries(WASHES))('%s matches the documented ratios', (appearance, rows) => {
    const tokens = tokensFor(rules, {
      attrs: { 'data-appearance': appearance, 'data-contrast': 'normal' },
    })
    const close = (measured: number, ratio: number) => Math.abs(measured - ratio) <= 0.1
    const ink = ['--background', '--card', '--muted'].map((under, i) => [
      under,
      close(onWash(tokens, '--primary-ink', '--primary-soft', under), rows.ink[i] ?? 0),
    ])
    expect(ink).toEqual(ink.map(([under]) => [under, true]))
    expect(close(onWash(tokens, '--foreground', '--primary-soft', '--card'), rows.foreground)).toBe(
      true,
    )
    for (const mark of ['--fret-guitar', '--fret-bass', '--melody-vocals'] as const) {
      const tint = tokens.color(mark).clone()
      tint.alpha = 0.3
      const ratio = contrast(tokens.color('--ink'), over(tint, tokens.color('--paper')))
      expect([mark, Math.round(ratio * 10) / 10 >= rows.head]).toEqual([mark, true])
    }
  })
})

describe('§4.6 baseline values', () => {
  // The table in doc 26 §4.6 (one decimal, so ±0.1). A value change must update the doc too.
  const DARK: [string, string, number][] = [
    ['--foreground', '--background', 21],
    ['--muted-foreground', '--card', 7.4],
    ['--primary-foreground', '--primary', 21],
    ['--ring', '--background', 21],
    ['--input', '--card', 3.8],
    ['--ink', '--paper', 21],
    ['--conf-medium', '--paper', 21],
    ['--conf-low', '--paper', 8.5],
    ['--score-loop-edge', '--paper', 21],
    ['--score-playhead', '--paper', 21],
    ['--staff', '--paper', 4.4],
    ['--staff', '--score-loop-fill', 3.9],
  ]
  const BASELINE: Record<string, [string, string, number][]> = {
    dark: DARK,
    stage: DARK,
    light: [
      ['--foreground', '--background', 19.4],
      ['--muted-foreground', '--card', 8.5],
      ['--primary-foreground', '--primary', 19.4],
      ['--ring', '--background', 19.4],
      ['--input', '--card', 3.6],
      ['--ink', '--paper', 19.4],
      ['--conf-medium', '--paper', 19.4],
      ['--conf-low', '--paper', 6.1],
      ['--score-loop-edge', '--paper', 19.4],
      ['--score-playhead', '--paper', 19.4],
      ['--staff', '--paper', 3.9],
      ['--staff', '--score-loop-fill', 3.6],
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

describe('§4.8 surface and status-surface values', () => {
  // The table in doc 26 §4.8 (one decimal, so ±0.1): normal contrast, then increased contrast for
  // the muted text rows (warning and info are muted text).
  const DARK = {
    pairs: [
      ['--foreground', '--surface-raised', 18.7],
      ['--foreground', '--surface-sunken', 21],
      ['--muted-foreground', '--surface-raised', 7.4],
      ['--muted-foreground', '--surface-sunken', 8.3],
      ['--foreground', '--success-surface', 15.2],
      ['--foreground', '--warning-surface', 14.4],
      ['--foreground', '--info-surface', 18.7],
      ['--foreground', '--destructive-surface', 15.8],
      ['--success', '--success-surface', 7.3],
      ['--warning', '--warning-surface', 5.7],
      ['--info', '--info-surface', 7.4],
      ['--destructive', '--destructive-surface', 5.5],
      ['--unsure', '--unsure-surface', 6.4],
    ],
    more: [
      ['--muted-foreground', '--surface-raised', 11.7],
      ['--muted-foreground', '--surface-sunken', 13.1],
      ['--warning', '--warning-surface', 8.9],
      ['--info', '--info-surface', 11.7],
    ],
  } satisfies { pairs: [string, string, number][]; more: [string, string, number][] }
  const SURFACES: Record<string, typeof DARK> = {
    dark: DARK,
    stage: DARK,
    light: {
      pairs: [
        ['--foreground', '--surface-raised', 19.4],
        ['--foreground', '--surface-sunken', 19.4],
        ['--muted-foreground', '--surface-raised', 8.5],
        ['--muted-foreground', '--surface-sunken', 8.5],
        ['--foreground', '--success-surface', 17.2],
        ['--foreground', '--warning-surface', 16.4],
        ['--foreground', '--info-surface', 19.4],
        ['--foreground', '--destructive-surface', 16.9],
        ['--success', '--success-surface', 5.5],
        ['--warning', '--warning-surface', 7.2],
        ['--info', '--info-surface', 8.5],
        ['--destructive', '--destructive-surface', 4.8],
        ['--unsure', '--unsure-surface', 5.4],
      ],
      more: [
        ['--muted-foreground', '--surface-raised', 12.6],
        ['--muted-foreground', '--surface-sunken', 12.6],
        ['--warning', '--warning-surface', 10.7],
        ['--info', '--info-surface', 12.6],
      ],
    },
  }
  it.each(Object.entries(SURFACES))('%s matches the documented ratios', (appearance, rows) => {
    for (const [contrastMode, pairs] of [
      ['normal', rows.pairs],
      ['more', rows.more],
    ] as const) {
      const tokens = tokensFor(rules, {
        attrs: { 'data-appearance': appearance, 'data-contrast': contrastMode },
      })
      for (const [fg, bg, ratio] of pairs) {
        const measured = contrast(tokens.color(fg), tokens.color(bg))
        expect([contrastMode, fg, bg, Math.abs(measured - ratio) <= 0.1]).toEqual([
          contrastMode,
          fg,
          bg,
          true,
        ])
      }
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
