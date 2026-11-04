import {
  type Beats,
  type Chords,
  type DrumNotes,
  type Instrument,
  instrumentProfile,
  type Notes,
  SCHEMA_VERSION,
  type Stems,
  type Summary,
  type Tab,
} from '@splitune/contracts'
import { buildTab, confidenceBand, type FingeringMode, recordedBands } from '@splitune/music-core'
import type { z } from 'zod'
import { recommendView, type ViewsConfig } from './views.ts'

// finalize (06 §2): notes + beats + chords → tab.* and render.* (music-core buildTab) and the
// per-instrument summary that drives the chords-only fallback. Pure: the worker does the I/O.

type InstrumentName = z.infer<typeof Instrument>

type Transcription = z.infer<typeof Notes> | z.infer<typeof DrumNotes>

export interface FinalizeInputs {
  beats: z.infer<typeof Beats>
  chords?: z.infer<typeof Chords>
  stems?: z.infer<typeof Stems>
  // DrumNotes for drums (step 25): hits, not notes. The web builds the drum score from them and
  // the beats (music-core buildDrumScore), as it builds the piano roll, so finalize writes no
  // render.
  notes: Partial<Record<InstrumentName, Transcription>>
}

export interface FinalizeOptions {
  instruments: readonly InstrumentName[]
  fingeringMode?: FingeringMode
  // lite runs no separation or transcription: only missing chords make it partial.
  profile?: 'full' | 'lite'
}

export interface FinalizeResult {
  tabs: { instrument: InstrumentName; tab: z.infer<typeof Tab>; alphaTex: string }[]
  summary: z.infer<typeof Summary>
  // partial: some part of the requested result is missing (notes, chords or stems).
  status: 'done' | 'partial'
}

// An empty transcription counts as all-low: there is nothing note-exact to show. Drum hits count
// as notes.
export function noteStats(notes: Transcription): {
  noteConfidenceMean: number
  fractionLowConf: number
} {
  const list: readonly { confidence: number }[] = 'hits' in notes ? notes.hits : notes.notes
  if (list.length === 0) return { noteConfidenceMean: 0, fractionLowConf: 1 }
  const bands = recordedBands(notes)
  const mean = list.reduce((sum, n) => sum + n.confidence, 0) / list.length
  const low = list.filter((n) => confidenceBand(n.confidence, bands) === 'low').length
  return { noteConfidenceMean: round(mean), fractionLowConf: round(low / list.length) }
}

// Duration-weighted over chord segments; "N" (no chord) segments don't count.
export function chordsConfidenceMean(chords: z.infer<typeof Chords> | undefined): number {
  if (chords === undefined) return 0
  let weight = 0
  let total = 0
  for (const s of chords.segments) {
    if (s.label === 'N') continue
    const d = Math.max(0, s.t1 - s.t0)
    weight += d
    total += d * s.confidence
  }
  return weight > 0 ? round(total / weight) : 0
}

const round = (x: number) => Math.round(x * 10_000) / 10_000

function isolatedStemQuality(
  stems: z.infer<typeof Stems> | undefined,
  instrument: InstrumentName,
): 'good' | 'rough' | undefined {
  return stems?.stems.find((s) => s.kind === 'isolated' && s.instrument === instrument)
    ?.quality_hint
}

export function finalize(
  analysisId: string,
  inputs: FinalizeInputs,
  options: FinalizeOptions,
  views: ViewsConfig,
): FinalizeResult {
  const tabs: FinalizeResult['tabs'] = []
  const perInstrument = options.instruments.map((instrument) => {
    const notes = inputs.notes[instrument]
    if (notes !== undefined && !('hits' in notes) && instrumentProfile(instrument).tab) {
      const lowBandEnergy = Object.fromEntries(
        notes.notes.flatMap((n) =>
          n.low_band_energy === undefined ? [] : [[n.id, n.low_band_energy]],
        ),
      )
      const built = buildTab(
        notes,
        inputs.beats,
        {},
        {
          ...(inputs.chords === undefined ? {} : { chords: inputs.chords }),
          fingeringMode: options.fingeringMode ?? 'easiest',
          bands: recordedBands(notes),
          ...(instrument === 'bass' ? { lowBandEnergy } : {}),
        },
      )
      tabs.push({ instrument, tab: built.tab, alphaTex: built.alphaTex })
    }
    const stemQuality = isolatedStemQuality(inputs.stems, instrument)
    return recommendView(
      {
        instrument,
        ...(notes === undefined ? {} : { notes: noteStats(notes) }),
        ...(stemQuality === undefined ? {} : { stemQuality }),
        stemsUnavailable: inputs.stems === undefined,
      },
      views,
    )
  })
  const summary: z.infer<typeof Summary> = {
    schema_version: SCHEMA_VERSION,
    analysis_id: analysisId,
    per_instrument: perInstrument,
    chords_confidence_mean: chordsConfidenceMean(inputs.chords),
    rough_stems: (inputs.stems?.stems ?? [])
      .filter((s) => s.quality_hint === 'rough')
      .map((s) => s.stem_id),
  }
  const missing =
    inputs.chords === undefined ||
    (options.profile !== 'lite' &&
      (inputs.stems === undefined ||
        options.instruments.some((i) => inputs.notes[i] === undefined)))
  return { tabs, summary, status: missing ? 'partial' : 'done' }
}
