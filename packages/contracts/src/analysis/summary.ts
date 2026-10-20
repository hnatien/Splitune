import { z } from 'zod'
import { contracts } from '../registry.ts'
import { Instrument, SchemaVersion } from './common.ts'

export const RecommendedView = z
  .enum(['tab', 'notation', 'roll', 'drum_grid', 'f0', 'chords_only'])
  .register(contracts, { id: 'RecommendedView' })

// Machine codes from the recommended_view rule (05-analysis-schema.md), shown as plain-language banners.
export const ViewReason = z
  .enum(['notes_unavailable', 'notation_not_supported', 'rough_stem_low_conf', 'low_confidence'])
  .register(contracts, { id: 'ViewReason' })

export const InstrumentSummary = z
  .object({
    instrument: Instrument,
    note_confidence_mean: z.number().min(0).max(1),
    fraction_low_conf: z.number().min(0).max(1),
    recommended_view: RecommendedView,
    reasons: z.array(ViewReason),
  })
  .register(contracts, { id: 'InstrumentSummary' })

export const Summary = z
  .object({
    schema_version: SchemaVersion,
    analysis_id: z.uuid(),
    per_instrument: z.array(InstrumentSummary),
    chords_confidence_mean: z.number().min(0).max(1),
    rough_stems: z.array(z.string()),
  })
  .register(contracts, { id: 'Summary' })
