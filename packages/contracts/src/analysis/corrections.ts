import { z } from 'zod'
import { contracts } from '../registry.ts'
import { Note } from './notes.ts'
import { SectionLabel } from './sections.ts'

// Ops are an overlay keyed to (artefact_id, artefact_version, entity_id), applied in `rev` order
// by music-core `applyCorrections`; they never edit an artefact in place.

export const NotePatch = z
  .object({
    pitch_midi: z.number().int().min(21).max(108).optional(),
    onset_s: z.number().nonnegative().optional(),
    offset_s: z.number().nonnegative().optional(),
    string: z.number().int().min(1).max(7).optional(),
    fret: z.number().int().min(0).max(24).optional(),
  })
  .register(contracts, { id: 'NotePatch' })

export const NewNote = Note.omit({ confidence: true, confidence_raw: true }).register(contracts, {
  id: 'NewNote',
})

export const SetChordOp = z
  .object({
    op: z.literal('set_chord'),
    segment_id: z.string().min(1),
    label: z.string().min(1),
    bass: z.string().optional(),
  })
  .register(contracts, { id: 'SetChordOp' })

export const SplitChordOp = z
  .object({
    op: z.literal('split_chord'),
    segment_id: z.string().min(1),
    at_s: z.number().nonnegative(),
    label: z.string().min(1),
  })
  .register(contracts, { id: 'SplitChordOp' })

export const SetNoteOp = z
  .object({ op: z.literal('set_note'), note_id: z.string().min(1), patch: NotePatch })
  .register(contracts, { id: 'SetNoteOp' })

export const AddNoteOp = z
  .object({ op: z.literal('add_note'), note: NewNote })
  .register(contracts, { id: 'AddNoteOp' })

export const DeleteNoteOp = z
  .object({ op: z.literal('delete_note'), note_id: z.string().min(1) })
  .register(contracts, { id: 'DeleteNoteOp' })

export const ShiftDownbeatOp = z
  .object({ op: z.literal('shift_downbeat'), by_beats: z.number().int() })
  .register(contracts, { id: 'ShiftDownbeatOp' })

// `double` multiplies the detected tempo by 2, `half` by 0.5.
export const TempoOctaveOp = z
  .object({ op: z.literal('tempo_octave'), factor: z.enum(['double', 'half']) })
  .register(contracts, { id: 'TempoOctaveOp' })

export const NudgeBeatOp = z
  .object({ op: z.literal('nudge_beat'), beat_id: z.string().min(1), delta_s: z.number() })
  .register(contracts, { id: 'NudgeBeatOp' })

export const SetSectionOp = z
  .object({ op: z.literal('set_section'), segment_id: z.string().min(1), label: SectionLabel })
  .register(contracts, { id: 'SetSectionOp' })

// mark_correct and report_wrong don't change what is shown; they feed the correction-rate metric.
export const MarkCorrectOp = z
  .object({ op: z.literal('mark_correct'), entity_id: z.string().min(1) })
  .register(contracts, { id: 'MarkCorrectOp' })

export const ReportWrongOp = z
  .object({
    op: z.literal('report_wrong'),
    entity_id: z.string().min(1),
    comment: z.string().max(500).optional(),
  })
  .register(contracts, { id: 'ReportWrongOp' })

export const CorrectionOp = z
  .discriminatedUnion('op', [
    SetChordOp,
    SplitChordOp,
    SetNoteOp,
    AddNoteOp,
    DeleteNoteOp,
    ShiftDownbeatOp,
    TempoOctaveOp,
    NudgeBeatOp,
    SetSectionOp,
    MarkCorrectOp,
    ReportWrongOp,
  ])
  .register(contracts, { id: 'CorrectionOp' })
