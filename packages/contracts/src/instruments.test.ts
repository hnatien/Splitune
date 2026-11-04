import { describe, expect, it } from 'vitest'
import { Instrument } from './analysis/common.ts'
import { StageName } from './analysis/stage.ts'
import { FLAGS } from './api/flags.ts'
import { INSTRUMENTS, instrumentProfile, notesStages } from './instruments.ts'

describe('instrument profiles', () => {
  it('cover every instrument', () => {
    expect(Object.keys(INSTRUMENTS).sort()).toEqual([...Instrument.options].sort())
  })

  it.each(Instrument.options)('%s defaults to one of its own levels', (instrument) => {
    const { levels, defaultLevel } = instrumentProfile(instrument)
    expect(levels).toContain(defaultLevel)
  })

  it.each(Instrument.options)(
    '%s has a stage and flag the rest of the code knows',
    (instrument) => {
      const { notes } = instrumentProfile(instrument)
      if (notes === null) return
      expect(StageName.options).toContain(`notes.${instrument}`)
      if (notes.flag !== undefined) expect(Object.keys(FLAGS)).toContain(notes.flag)
    },
  )

  it('builds tabs only from pitched notes', () => {
    for (const [instrument, profile] of Object.entries(INSTRUMENTS)) {
      if (profile.tab) expect([instrument, profile.notes?.schema]).toEqual([instrument, 'notes'])
    }
  })

  it('gives every instrument with notes a score and none without', () => {
    for (const profile of Object.values(INSTRUMENTS)) {
      expect(profile.score === null).toBe(profile.notes === null)
    }
  })

  it('lists the notes stages for services/ml', () => {
    expect(notesStages()).toEqual({
      guitar: { reads: ['separation', 'stems'], schema: 'notes' },
      bass: { reads: ['separation', 'stems'], schema: 'notes' },
      piano: { reads: ['separation', 'stems'], schema: 'notes' },
      drums: { reads: ['separation', 'stems', 'beats'], schema: 'hits', flag: 'v1.drums' },
      vocals: { reads: ['separation', 'stems'], schema: 'notes' },
    })
  })
})
