import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { assignFrets, type FretStep, fretConfig, TUNINGS } from '../src/index.ts'

function chord(pitches: number[], time = 0, label?: string): FretStep {
  return {
    time,
    notes: pitches.map((pitch, i) => ({ id: `${time}:${i}`, pitch })),
    ...(label === undefined ? {} : { chord: label }),
  }
}

const frets = (steps: FretStep[], input = {}) =>
  assignFrets(steps, fretConfig(input)).map((step) =>
    step.map((a) => (a.string === undefined ? 'x' : `${a.string}/${a.fret}`)),
  )

describe('assignFrets', () => {
  it('voices common open chords in open position', () => {
    expect(frets([chord([48, 52, 55, 60, 64], 0, 'C:maj')])).toEqual([
      ['5/3', '4/2', '3/0', '2/1', '1/0'],
    ])
    expect(frets([chord([45, 52, 57, 60, 64], 0, 'A:min')])).toEqual([
      ['5/0', '4/2', '3/2', '2/1', '1/0'],
    ])
    expect(frets([chord([43, 47, 50, 55, 59, 67], 0, 'G:maj')])).toEqual([
      ['6/3', '5/2', '4/0', '3/0', '2/0', '1/3'],
    ])
  })

  it('prefers open strings for single notes in easiest mode', () => {
    expect(frets([chord([59])])).toEqual([['2/0']])
    expect(frets([chord([64])])).toEqual([['1/0']])
  })

  it('treats the capo as the nut', () => {
    const out = assignFrets([chord([66])], fretConfig({ capo: 2 }))[0]?.[0]
    expect(out).toMatchObject({ string: 1, fret: 2, unplayable: false })
    // F (65) is below the capo on string 1 but playable on string 2.
    expect(assignFrets([chord([65])], fretConfig({ capo: 2 }))[0]?.[0]).toMatchObject({
      string: 2,
      fret: 6,
    })
  })

  it('moves out-of-range pitches by octaves and marks them unplayable', () => {
    const [low] = assignFrets([chord([30])], fretConfig())[0] ?? []
    expect(low).toMatchObject({ soundingPitch: 42, unplayable: true })
    expect(low?.string).toBeDefined()
  })

  it('drops notes a chord cannot hold within the span and marks them unplayable', () => {
    // F2 only exists at 6/1, G5 at 1/15 or 2/20: no hand spans both.
    const out = assignFrets([chord([41, 79])], fretConfig())[0] ?? []
    expect(out.filter((a) => a.unplayable && a.string === undefined)).toHaveLength(1)
    expect(out.filter((a) => a.string !== undefined)).toHaveLength(1)
  })

  it('keeps more than six notes to the strings available', () => {
    const out = assignFrets([chord([40, 45, 50, 55, 59, 64, 67])], fretConfig())[0] ?? []
    expect(out.filter((a) => a.string !== undefined)).toHaveLength(6)
    expect(out.filter((a) => a.unplayable)).toHaveLength(1)
  })

  it('honours a valid pin and ignores one that does not sound the pitch', () => {
    const pinned = assignFrets(
      [{ time: 0, notes: [{ id: 'a', pitch: 64, pin: { string: 2, fret: 5 } }] }],
      fretConfig(),
    )
    expect(pinned[0]?.[0]).toMatchObject({ string: 2, fret: 5 })
    const bad = assignFrets(
      [{ time: 0, notes: [{ id: 'a', pitch: 64, pin: { string: 2, fret: 6 } }] }],
      fretConfig(),
    )
    expect(bad[0]?.[0]).toMatchObject({ string: 1, fret: 0 })
  })

  it('returns up to two distinct alternative fingerings with non-negative costs', () => {
    const [a] = assignFrets([chord([60])], fretConfig())[0] ?? []
    expect(a?.altFingerings.length).toBe(2)
    for (const alt of a?.altFingerings ?? []) {
      expect(alt.cost).toBeGreaterThanOrEqual(0)
      expect(`${alt.string}/${alt.fret}`).not.toBe(`${a?.string}/${a?.fret}`)
    }
  })

  it('keeps a fast line in one position instead of jumping for open strings', () => {
    // A minor pentatonic box at the 5th fret, sixteenths at 120 bpm.
    const line = [45, 48, 50, 52, 55, 57, 60, 57, 55, 52].map((p, i) => chord([p], i * 0.125))
    const out = assignFrets(line, fretConfig({ mode: 'as_played' })).flat()
    const fretted = out.map((a) => a.fret ?? 0)
    expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(4)
  })

  it('uses bass presets and the root–fifth prior', () => {
    const config = fretConfig({ instrument: 'bass' })
    expect(config.tuningMidi).toEqual(TUNINGS.bass4_standard)
    expect(config.maxSpan).toBe(4)
    const out = assignFrets([chord([33], 0), chord([40], 0.5)], config).flat()
    expect(out.map((a) => `${a.string}/${a.fret}`)).toEqual(['3/0', '2/2'])
  })

  it('validates the configuration', () => {
    expect(() => fretConfig({ capo: 13 })).toThrow(RangeError)
    expect(() => fretConfig({ tuningMidi: [] })).toThrow(RangeError)
    expect(() => fretConfig({ maxFret: 30 })).toThrow(RangeError)
  })
})

describe('assignFrets properties', () => {
  const tuning = fc.constantFrom<readonly number[]>(
    TUNINGS.guitar_standard,
    TUNINGS.guitar_drop_d,
    TUNINGS.guitar_half_step_down,
    TUNINGS.bass4_standard,
    TUNINGS.bass5_standard,
  )
  const steps = fc.array(
    fc.record({
      dt: fc.double({ min: 0.05, max: 2, noNaN: true }),
      pitches: fc.uniqueArray(fc.integer({ min: 23, max: 90 }), { minLength: 1, maxLength: 7 }),
    }),
    { minLength: 1, maxLength: 25 },
  )
  const settings = fc.record({
    tuning,
    capo: fc.integer({ min: 0, max: 7 }),
    maxSpan: fc.integer({ min: 3, max: 5 }),
    mode: fc.constantFrom('easiest' as const, 'as_played' as const),
  })

  it('every placed note sounds its (possibly octave-shifted) pitch and stays within maxSpan', () => {
    fc.assert(
      fc.property(settings, steps, (s, raw) => {
        const config = fretConfig({
          tuningMidi: s.tuning,
          capo: s.capo,
          maxSpan: s.maxSpan,
          mode: s.mode,
        })
        let time = 0
        const input = raw.map((r, k) => {
          time += r.dt
          return { time, notes: r.pitches.map((pitch, i) => ({ id: `${k}:${i}`, pitch })) }
        })
        const out = assignFrets(input, config)
        out.forEach((step, k) => {
          const strings = new Set<number>()
          const fretted: number[] = []
          step.forEach((a, i) => {
            const pitch = input[k]?.notes[i]?.pitch as number
            if (!a.unplayable) expect(a.soundingPitch).toBe(pitch)
            expect(Math.abs(a.soundingPitch - pitch) % 12).toBe(0)
            if (a.string === undefined || a.fret === undefined) return
            expect((config.tuningMidi[a.string - 1] as number) + a.fret).toBe(a.soundingPitch)
            expect(a.fret).toBeGreaterThanOrEqual(config.capo)
            expect(a.fret).toBeLessThanOrEqual(config.maxFret)
            expect(strings.has(a.string)).toBe(false)
            strings.add(a.string)
            if (a.fret > config.capo) fretted.push(a.fret)
          })
          if (fretted.length > 0)
            expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(config.maxSpan)
        })
      }),
      { numRuns: 300 },
    )
  })

  it('is deterministic', () => {
    fc.assert(
      fc.property(steps, (raw) => {
        const input = raw.map((r, k) => ({
          time: k * 0.25,
          notes: r.pitches.map((pitch, i) => ({ id: `${k}:${i}`, pitch })),
        }))
        expect(assignFrets(input, fretConfig())).toEqual(assignFrets(input, fretConfig()))
      }),
      { numRuns: 50 },
    )
  })
})
