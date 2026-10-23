import { describe, expect, it } from 'vitest'
import { pianoVoicing, voiceChords } from '../src/index.ts'

describe('pianoVoicing', () => {
  it('puts the root in the left hand and the rest of a seventh chord in the right', () => {
    expect(pianoVoicing('D#:maj7', { style: 'root' })).toEqual({ left: [39], right: [55, 58, 62] })
    expect(pianoVoicing('F:min7', { style: 'root' })).toEqual({ left: [41], right: [56, 60, 63] })
  })

  it('keeps the root in the right hand of a triad', () => {
    expect(pianoVoicing('C:maj', { style: 'root' })).toEqual({ left: [36], right: [60, 64, 67] })
  })

  it('plays the slash note in the left hand and keeps the root above it', () => {
    expect(pianoVoicing('C:maj/3', { style: 'root' })).toEqual({ left: [40], right: [60, 64, 67] })
    expect(pianoVoicing('C:maj', { bass: 'G', style: 'root' })?.left).toEqual([43])
  })

  it('moves the right hand as little as possible from the previous chord', () => {
    const ab = pianoVoicing('G#:maj7', { previous: [55, 58, 62], style: 'smooth' })
    // G stays, B♭ → C, D → E♭.
    expect(ab?.right).toEqual([55, 60, 63])
    // Root position ignores the previous chord: the third at the bottom once the root is in L.
    expect(pianoVoicing('G#:maj7', { previous: [55, 58, 62], style: 'root' })?.right).toEqual([
      60, 63, 67,
    ])
    expect(pianoVoicing('G:maj', { previous: [60, 64, 67], style: 'smooth' })?.right).toEqual([
      59, 62, 67,
    ])
  })

  it('thins chords with many tones to four right-hand notes, the fifth first', () => {
    const v = pianoVoicing('C:13', { style: 'root' })
    expect(v?.right).toHaveLength(4)
    expect(v?.right.map((n) => n % 12)).not.toContain(7)
  })

  it('stays in the right hand range', () => {
    for (const label of ['C:maj', 'F#:min7', 'B:hdim7', 'Ab:9', 'E:sus4', 'G:5']) {
      for (const previous of [null, [52, 55, 59], [69, 72, 76]]) {
        const v = pianoVoicing(label, { previous })
        expect(v?.right.length).toBeGreaterThan(0)
        expect(Math.min(...(v?.right ?? []))).toBeGreaterThanOrEqual(52)
        expect(Math.max(...(v?.right ?? []))).toBeLessThanOrEqual(72)
        expect(v?.left[0]).toBeGreaterThanOrEqual(36)
        expect(v?.left[0]).toBeLessThan(48)
      }
    }
  })

  it('has no voicing for no chord or an unknown label', () => {
    expect(pianoVoicing('N')).toBeNull()
    expect(pianoVoicing('X')).toBeNull()
    expect(pianoVoicing('nonsense')).toBeNull()
  })
})

describe('voiceChords', () => {
  it('leads each chord from the last one voiced, across gaps', () => {
    const voicings = voiceChords(
      [{ label: 'D#:maj7' }, { label: 'N' }, { label: 'G#:maj7' }, { label: 'A#:7' }],
      'smooth',
    )
    expect(voicings[0]?.right).toEqual([55, 58, 62])
    expect(voicings[1]).toBeNull()
    expect(voicings[2]?.right).toEqual([55, 60, 63])
    expect(voicings[3]?.left).toEqual([46])
  })
})
