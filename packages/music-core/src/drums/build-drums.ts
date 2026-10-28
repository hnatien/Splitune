import { type BandThresholds, confidenceBand, DEFAULT_BANDS } from '../calibration/lookup.ts'
import { applyBeatCorrections } from '../corrections/apply.ts'
import { type DrumHitRef, FEET, toDrumAlphaTex } from '../export/alphatex-drums.ts'
import { createBeatGrid, positionOfTick, tickToTime } from '../grid/beatgrid.ts'
import { type DrumLevel, drumsAtLevel } from '../level/drums.ts'
import { type QuantizeOptions, quantizeDrumHits } from '../quantize/quantize.ts'
import type { Beats, CorrectionOp, DrumHit, DrumNotes } from '../types.ts'

// The drum counterpart of buildPianoScore (step 25), called by the web Worker: effective beats
// (corrections) → quantizeDrumHits (flams kept as flams) → level → hands/feet voices and the
// drum staff's alphaTex. The editor has no drum editing in this step, so only beat corrections
// apply; drum ops would join CorrectionOp when it gets some.

export interface DrumCorrections {
  beats?: readonly CorrectionOp[]
}

export interface BuildDrumOptions {
  bands?: BandThresholds
  level?: DrumLevel
  quantize?: QuantizeOptions
  title?: string
}

export interface DrumScoreHit {
  id: string // notes.drums hit id; `groove:…` for a main-pattern hit written into a fill bar
  class5: DrumHit['class5']
  gmNote: number
  onTick: number // global ticks of the beat grid (grid/beatgrid.ts)
  t0: number // onTick in seconds on the decoded-PCM timeline
  bar: number
  beat: number
  tick: number
  confidence: number
  band: 'high' | 'medium' | 'low'
  approximate: boolean // a kit-piece guess (or a generated groove hit): drawn as unsure
  flam: boolean
  mergedIds: string[] // later hits of a flam folded into this one
  residualFlagged: boolean // onset far from the grid (> 60 ms)
  foot: boolean // kick or pedal hi-hat: the stems-down voice
  generated: boolean // core_groove's main pattern in a fill bar, not in notes.drums
}

export interface DrumScore {
  level: DrumLevel
  hits: DrumScoreHit[] // at the level, by onset, then GM key
  fillBars: number[]
  swingBars: number[]
  alphaTex: string // the drum staff (export/alphatex-drums.ts)
  alphaTexFirstBar: number
  hitMap: DrumHitRef[] // rendered alphaTab note (bar, voice, beat, note) → hit id
  effective: { beats: Beats }
  skippedCorrections: { beats: number[] }
}

export function buildDrumScore(
  drums: Pick<DrumNotes, 'instrument' | 'hits'>,
  beats: Beats,
  corrections: DrumCorrections = {},
  options: BuildDrumOptions = {},
): DrumScore {
  if (drums.instrument !== 'drums') {
    throw new RangeError(`buildDrumScore supports drums, not ${drums.instrument}`)
  }
  const bands = options.bands ?? DEFAULT_BANDS
  const level = options.level ?? 'as_transcribed'
  const effBeats = applyBeatCorrections(beats, corrections.beats ?? [])
  const grid = createBeatGrid(effBeats.value)
  const quantized = quantizeDrumHits(drums.hits, grid, options.quantize)
  const byId = new Map(drums.hits.map((h) => [h.id, h]))
  const transcribed = quantized.hits.map((q) => {
    const hit = byId.get(q.hitId) as DrumHit
    return {
      id: q.hitId,
      class5: q.class5,
      gmNote: q.gmNote,
      onTick: q.onTick,
      confidence: hit.confidence,
      approximate: hit.approximate,
      flam: q.flam,
      mergedIds: q.mergedIds,
      residualFlagged: q.residualFlagged,
    }
  })
  const leveled = drumsAtLevel(transcribed, level, grid, quantized.swingBars)
  const hits = leveled.hits
    .map((h): DrumScoreHit => {
      const generated = 'generated' in h
      return {
        id: h.id,
        class5: h.class5,
        gmNote: h.gmNote,
        onTick: h.onTick,
        t0: tickToTime(grid, h.onTick),
        ...positionOfTick(grid, h.onTick),
        confidence: h.confidence,
        band: confidenceBand(h.confidence, bands),
        approximate: generated || ('approximate' in h && h.approximate),
        flam: 'flam' in h && h.flam,
        mergedIds: 'mergedIds' in h ? h.mergedIds : [],
        residualFlagged: 'residualFlagged' in h && h.residualFlagged,
        foot: FEET.has(h.gmNote),
        generated,
      }
    })
    .sort((a, b) => a.onTick - b.onTick || a.gmNote - b.gmNote || a.id.localeCompare(b.id))

  const tex = toDrumAlphaTex({
    grid,
    meterDenominator: effBeats.value.meter.denominator,
    tempo: effBeats.value.bpm,
    hits: hits.map((h) => ({ hitId: h.id, gmNote: h.gmNote, onTick: h.onTick, flam: h.flam })),
    swingBars: quantized.swingBars,
    ...(options.title === undefined ? {} : { title: options.title }),
  })
  return {
    level,
    hits,
    fillBars: leveled.fillBars,
    swingBars: quantized.swingBars,
    alphaTex: tex.tex,
    alphaTexFirstBar: tex.firstBar,
    hitMap: tex.hitMap,
    effective: { beats: effBeats.value },
    skippedCorrections: { beats: effBeats.skipped },
  }
}
