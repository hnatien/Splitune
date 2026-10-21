// Categorical stem colours stay distinguishable under simulated colour-vision deficiency
// (docs/implementation/28-ui-quality-and-design-review.md §3): ΔE2000 ≥ 12 for every pair, in
// every appearance and contrast context, for normal vision and full protanopia, deuteranopia and
// tritanopia (Machado, Oliveira & Fernandes 2009, severity 1.0, applied in linear sRGB).
import Color from 'colorjs.io'
import { describe, expect, it } from 'vitest'
import { STEMS } from './index.ts'
import { CONTEXTS, loadRules, tokensFor } from './testing/cascade.ts'

type Matrix = [[number, number, number], [number, number, number], [number, number, number]]

const MACHADO = {
  normal: null,
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} satisfies Record<string, Matrix | null>

const MIN_DELTA_E = 12

function simulate(color: Color, matrix: Matrix | null): Color {
  if (!matrix) return color
  const [r, g, b] = color.to('srgb-linear').coords.map((v) => v ?? 0) as [number, number, number]
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return new Color(
    'srgb-linear',
    matrix.map((row) => clamp(row[0] * r + row[1] * g + row[2] * b)) as [number, number, number],
  )
}

const rules = loadRules()
const stems = Object.entries(STEMS)

describe.each(CONTEXTS)('$name', ({ context }) => {
  const tokens = tokensFor(rules, context)
  it.each(Object.entries(MACHADO))(`stems stay ≥${MIN_DELTA_E} ΔE2000 apart (%s)`, (_, matrix) => {
    const simulated = stems.map(
      ([kind, { token }]) => [kind, simulate(tokens.color(token), matrix)] as const,
    )
    for (const [i, [a, colorA]] of simulated.entries()) {
      for (const [b, colorB] of simulated.slice(i + 1)) {
        expect([a, b, colorA.deltaE(colorB, '2000')]).toEqual([
          a,
          b,
          expect.toSatisfy((d: number) => d >= MIN_DELTA_E),
        ])
      }
    }
  })
})

describe('simulation', () => {
  it('collapses red and green for a deuteranope', () => {
    const deuteranopia = MACHADO.deuteranopia
    const red = simulate(new Color('#d55e00'), deuteranopia)
    const orange = simulate(new Color('#e69f00'), deuteranopia)
    expect(red.deltaE(orange, '2000')).toBeLessThan(
      new Color('#d55e00').deltaE(new Color('#e69f00'), '2000'),
    )
  })
})
