import type * as C from '@splitune/contracts'
import type { z } from 'zod'

export type Beat = z.infer<typeof C.Beat>
export type Beats = z.infer<typeof C.Beats>
export type Note = z.infer<typeof C.Note>
export type Notes = z.infer<typeof C.Notes>
export type DrumHit = z.infer<typeof C.DrumHit>
export type DrumNotes = z.infer<typeof C.DrumNotes>
export type ChordSegment = z.infer<typeof C.ChordSegment>
export type Chords = z.infer<typeof C.Chords>
export type SectionSegment = z.infer<typeof C.SectionSegment>
export type Sections = z.infer<typeof C.Sections>
export type CorrectionOp = z.infer<typeof C.CorrectionOp>
export type Tab = z.infer<typeof C.Tab>
export type TabEvent = z.infer<typeof C.TabEvent>
export type TabLevel = z.infer<typeof C.TabLevel>
export type AltFingering = z.infer<typeof C.AltFingering>
export type ConfidenceBand = z.infer<typeof C.ConfidenceBand>
export type CalibrationTable = z.infer<typeof C.CalibrationTable>
export type Key = z.infer<typeof C.Key>
