import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import * as schemas from './index.ts'

// fixtures/index.json is shared with services/ml (test_contracts.py) so both languages check the
// same documents against the same named types.
interface FixtureEntry {
  file: string
  type: string
  list?: boolean
  reason?: string
}

const fixturesDir = new URL('../fixtures/', import.meta.url)
const index = JSON.parse(readFileSync(new URL('index.json', fixturesDir), 'utf8')) as {
  valid: FixtureEntry[]
  invalid: FixtureEntry[]
}

function schemaFor(entry: FixtureEntry): z.ZodType {
  const schema: unknown = (schemas as Record<string, unknown>)[entry.type]
  if (!(schema instanceof z.ZodType)) throw new Error(`no schema named ${entry.type}`)
  return entry.list === true ? z.array(schema) : schema
}

function load(entry: FixtureEntry): unknown {
  return JSON.parse(readFileSync(new URL(entry.file, fixturesDir), 'utf8'))
}

describe('golden fixtures', () => {
  it.each(index.valid.map((entry) => [entry.file, entry] as const))('%s is valid', (_, entry) => {
    const result = schemaFor(entry).safeParse(load(entry))
    expect(result.error?.issues).toBeUndefined()
  })

  it.each(index.invalid.map((entry) => [entry.file, entry] as const))(
    '%s is rejected',
    (_, entry) => {
      // Exactly one issue: each broken fixture differs from a valid one in a single place.
      expect(schemaFor(entry).safeParse(load(entry)).error?.issues).toHaveLength(1)
    },
  )

  it('covers every top-level artefact and stage document', () => {
    const covered = new Set(index.valid.map((entry) => entry.type))
    for (const type of [
      'Manifest',
      'Beats',
      'Presence',
      'Stems',
      'Sections',
      'Chords',
      'Notes',
      'DrumNotes',
      'Tab',
      'Summary',
      'CorrectionOp',
      'StageRequest',
      'StageResult',
      'JobEvent',
    ]) {
      expect(covered).toContain(type)
    }
  })

  it('covers every correction op', () => {
    const corrections = index.valid.find((entry) => entry.file === 'corrections.json')
    if (corrections === undefined) throw new Error('corrections.json missing from index')
    const ops = z.array(schemas.CorrectionOp).parse(load(corrections))
    expect(new Set(ops.map((op) => op.op))).toEqual(
      new Set(schemas.CorrectionOp.options.map((option) => option.shape.op.value)),
    )
  })

  it('keeps tab events pointing at notes that exist', () => {
    const notes = schemas.Notes.parse(load({ file: 'notes.guitar.json', type: 'Notes' }))
    const tab = schemas.Tab.parse(load({ file: 'tab.guitar.json', type: 'Tab' }))
    const ids = new Set(notes.notes.map((note) => note.id))
    expect(tab.events.every((event) => ids.has(event.note_id))).toBe(true)
  })

  it('ignores unknown fields instead of rejecting them (S8)', () => {
    const beats = load({ file: 'beats.json', type: 'Beats' }) as Record<string, unknown>
    const parsed = schemas.Beats.parse({ ...beats, added_in_1_1: true })
    expect(parsed).not.toHaveProperty('added_in_1_1')
  })
})
