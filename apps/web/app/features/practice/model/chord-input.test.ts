import { describe, expect, it } from 'vitest'
import { oneIn, parseChordInput } from './chord-input'

describe('chord input', () => {
  it('reads chart names', () => {
    expect(parseChordInput('Am7')).toEqual({ label: 'A:min7' })
    expect(parseChordInput('F#m')).toEqual({ label: 'F#:min' })
    expect(parseChordInput('Bb')).toEqual({ label: 'Bb:maj' })
    expect(parseChordInput('G/B')).toEqual({ label: 'G:maj', bass: 'B' })
    expect(parseChordInput(' Dsus4 ')).toEqual({ label: 'D:sus4' })
  })

  it('accepts Harte labels and no-chord', () => {
    expect(parseChordInput('A:min7')).toEqual({ label: 'A:min7' })
    expect(parseChordInput('N')).toEqual({ label: 'N' })
  })

  it('refuses what isn’t a chord', () => {
    expect(parseChordInput('')).toBeNull()
    expect(parseChordInput('H7')).toBeNull()
    expect(parseChordInput('Amaj13#11')).toBeNull()
    expect(parseChordInput('A:nonsense')).toBeNull()
  })

  it('turns probabilities into frequencies', () => {
    expect(oneIn(0.33)).toBe(3)
    expect(oneIn(0.5)).toBe(2)
    expect(oneIn(0)).toBe(1000)
  })
})
