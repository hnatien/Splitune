import { readFileSync } from 'node:fs'
import * as alphaTab from '@coderline/alphatab'
import { Beats, Chords, Notes, Stems } from '@splitune/contracts'
import type { z } from 'zod'

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../packages/contracts/fixtures/${name}.json`, import.meta.url),
      'utf8',
    ),
  )

export const ANALYSIS_ID = '0192f6c4-8b00-7a00-8000-0000000000aa'
export const beats = () => Beats.parse(fixture('beats'))
export const chords = () => Chords.parse(fixture('chords'))
export const stems = () => Stems.parse(fixture('stems'))
export const guitarNotes = () => Notes.parse(fixture('notes.guitar'))

// The guitar fixture an octave down as a bass part, with low-band energies for octave correction.
export function bassNotes(): z.infer<typeof Notes> {
  const notes = guitarNotes()
  return {
    ...notes,
    artefact: 'notes.bass',
    instrument: 'bass',
    notes: notes.notes.map((n, i) => ({
      ...n,
      pitch_midi: Math.max(28, n.pitch_midi - 12),
      stem_id: 'bass',
      low_band_energy: i % 2 === 0 ? 0.8 : 0.1,
    })),
  }
}

// Loads alphaTex with the alphaTab 1.8 importer; returns error diagnostics (warnings and hints
// are allowed) and the parsed score.
export function parseAlphaTex(tex: string): { score: alphaTab.model.Score; errors: string[] } {
  const importer = new alphaTab.importer.AlphaTexImporter()
  importer.logErrors = false
  importer.initFromString(tex, new alphaTab.Settings())
  const score = importer.readScore()
  const errors = [
    importer.lexerDiagnostics,
    importer.parserDiagnostics,
    importer.semanticDiagnostics,
  ]
    .flatMap((bag) => bag.items)
    .filter((d) => d.severity === alphaTab.importer.alphaTex.AlphaTexDiagnosticsSeverity.Error)
    .map((d) => d.message)
  return { score, errors }
}
