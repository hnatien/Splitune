import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  Instrument,
  type InstrumentSummary,
  RecommendedView,
  type ViewReason,
} from '@splitune/contracts'
import { load } from 'js-yaml'
import { z } from 'zod'

// The recommended_view rule of 05-analysis-schema.md; thresholds from services/ml/config/views.yaml.

export const DEFAULT_VIEWS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../services/ml/config/views.yaml',
)

export const ViewsConfig = z.object({
  version: z.number().int().positive(),
  notation_supported: z.array(Instrument),
  rough_stem_low_conf: z.number().min(0).max(1),
  low_confidence: z.number().min(0).max(1),
  quality_gate: z.partialRecord(Instrument, z.enum(['pass', 'fail'])),
  defaults: z.record(Instrument, RecommendedView),
})
export type ViewsConfig = z.infer<typeof ViewsConfig>

export function loadViews(path = DEFAULT_VIEWS_PATH): ViewsConfig {
  return ViewsConfig.parse(load(readFileSync(path, 'utf8')))
}

export interface ViewInput {
  instrument: z.infer<typeof Instrument>
  // undefined: the notes stage failed or was skipped.
  notes?: { noteConfidenceMean: number; fractionLowConf: number }
  stemQuality?: 'good' | 'rough' // quality_hint of the instrument's isolated stem
  stemsUnavailable: boolean // separation failed: notes came from the mixture
}

// Rules in order: notes missing → notation not supported → Prototype 2 gate failed → rough stem
// with many low-confidence notes → too many low-confidence notes → the instrument default.
export function recommendView(
  input: ViewInput,
  views: ViewsConfig,
): z.infer<typeof InstrumentSummary> {
  const { instrument, notes } = input
  const reasons: z.infer<typeof ViewReason>[] = []
  if (input.stemsUnavailable && notes !== undefined) reasons.push('stems_unavailable')
  const summary = (view: z.infer<typeof RecommendedView>) => ({
    instrument,
    note_confidence_mean: notes?.noteConfidenceMean ?? 0,
    fraction_low_conf: notes?.fractionLowConf ?? 0,
    recommended_view: view,
    reasons,
  })
  const chordsOnly = (reason: z.infer<typeof ViewReason>) => {
    reasons.push(reason)
    return summary('chords_only')
  }
  if (notes === undefined) return chordsOnly('notes_unavailable')
  if (!views.notation_supported.includes(instrument)) return chordsOnly('notation_not_supported')
  if (views.quality_gate[instrument] === 'fail') return chordsOnly('quality_gate_failed')
  if (input.stemQuality === 'rough' && notes.fractionLowConf > views.rough_stem_low_conf) {
    return chordsOnly('rough_stem_low_conf')
  }
  if (notes.fractionLowConf > views.low_confidence) return chordsOnly('low_confidence')
  return summary(views.defaults[instrument])
}
