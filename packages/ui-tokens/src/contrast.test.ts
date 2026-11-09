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

  it('only the washes, the Night chip hairline and the scrim are translucent', () => {
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
    dark: { ink: [8.8, 7.9, 7.1], foreground: 12.0, head: 9.5 },
    light: { ink: [5.1, 5.4, 4.9], foreground: 15.4, head: 10.6 },
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
  const NIGHT: [string, string, number][] = [
    ['--foreground', '--background', 16.9],
    ['--muted-foreground', '--card', 9.9],
    ['--primary-foreground', '--primary', 9.7],
    ['--ring', '--background', 10.1],
    ['--input', '--card', 3.4],
    ['--ink', '--paper', 16.9],
    ['--conf-medium', '--paper', 16.9],
    ['--conf-low', '--paper', 9.6],
    ['--score-loop-edge', '--paper', 10.1],
    ['--score-playhead', '--paper', 10.1],
    ['--staff', '--paper', 4.0],
    ['--staff', '--score-loop-fill', 3.7],
  ]
  const BASELINE: Record<string, [string, string, number][]> = {
    dark: NIGHT,
    stage: NIGHT,
    light: [
      ['--foreground', '--background', 16.4],
      ['--muted-foreground', '--card', 9.1],
      ['--primary-foreground', '--primary', 9.7],
      ['--ring', '--background', 5.8],
      ['--input', '--card', 3.5],
      ['--ink', '--paper', 16.4],
      ['--conf-medium', '--paper', 16.4],
      ['--conf-low', '--paper', 5.6],
      ['--score-loop-edge', '--paper', 3.6],
      ['--score-playhead', '--paper', 3.6],
      ['--staff', '--paper', 3.6],
      ['--staff', '--score-loop-fill', 3.5],
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
  const NIGHT = {
    pairs: [
      ['--foreground', '--surface-raised', 15.7],
      ['--foreground', '--surface-sunken', 16.9],
      ['--muted-foreground', '--surface-raised', 9.9],
      ['--muted-foreground', '--surface-sunken', 10.7],
      ['--foreground', '--success-surface', 11.9],
      ['--foreground', '--warning-surface', 12.2],
      ['--foreground', '--info-surface', 15.7],
      ['--foreground', '--destructive-surface', 12.7],
      ['--success', '--success-surface', 7.4],
      ['--warning', '--warning-surface', 7.7],
      ['--info', '--info-surface', 9.9],
      ['--destructive', '--destructive-surface', 5.5],
      ['--unsure', '--unsure-surface', 7.3],
    ],
    more: [
      ['--muted-foreground', '--surface-raised', 12.1],
      ['--muted-foreground', '--surface-sunken', 13.0],
      ['--warning', '--warning-surface', 9.4],
      ['--info', '--info-surface', 12.1],
    ],
  } satisfies { pairs: [string, string, number][]; more: [string, string, number][] }
  const SURFACES: Record<string, typeof NIGHT> = {
    dark: NIGHT,
    stage: NIGHT,
    light: {
      pairs: [
        ['--foreground', '--surface-raised', 17.4],
        ['--foreground', '--surface-sunken', 16.4],
        ['--muted-foreground', '--surface-raised', 9.1],
        ['--muted-foreground', '--surface-sunken', 8.5],
        ['--foreground', '--success-surface', 14.7],
        ['--foreground', '--warning-surface', 13.8],
        ['--foreground', '--info-surface', 17.4],
        ['--foreground', '--destructive-surface', 14.9],
        ['--success', '--success-surface', 4.7],
        ['--warning', '--warning-surface', 7.2],
        ['--info', '--info-surface', 9.1],
        ['--destructive', '--destructive-surface', 5.1],
        ['--unsure', '--unsure-surface', 4.9],
      ],
      more: [
        ['--muted-foreground', '--surface-raised', 12.0],
        ['--muted-foreground', '--surface-sunken', 11.3],
        ['--warning', '--warning-surface', 9.5],
        ['--info', '--info-surface', 12.0],
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
