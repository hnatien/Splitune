import type { ChordSegment, Key, Note } from '../types.ts'
import { parseChord, pcName } from './chordtools.ts'

// Krumhansl–Kessler probe-tone profiles, index 0 = tonic.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

const ROOT_WEIGHT = 1
const CHORD_TONE_WEIGHT = 0.5
const NOTES_WEIGHT = 0.5 // relative to the chord histogram when both are present
const SOFTMAX_TEMPERATURE = 0.05

// Keys conventionally written with flats.
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]) // F Bb Eb Ab Db Gb
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]) // D G C F Bb Eb

export interface KeyEstimate extends Key {
  tonicPc: number
  ranking: { tonicPc: number; mode: 'major' | 'minor'; correlation: number }[]
}

function normalise(histogram: number[]): number[] {
  const total = histogram.reduce((a, b) => a + b, 0)
  return total > 0 ? histogram.map((v) => v / total) : histogram
}

function pearson(a: readonly number[], b: readonly number[]): number {
  const n = a.length
  const meanA = a.reduce((s, v) => s + v, 0) / n
  const meanB = b.reduce((s, v) => s + v, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const x = (a[i] as number) - meanA
    const y = (b[i] as number) - meanB
    num += x * y
    da += x * x
    db += y * y
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db)
}

export function chordHistogram(segments: readonly ChordSegment[]): number[] {
  const histogram = new Array<number>(12).fill(0)
  for (const segment of segments) {
    const parsed = parseChord(segment.label)
    if (parsed === null || parsed.kind !== 'chord') continue
    const duration = Math.max(0, segment.t1 - segment.t0)
    for (const pc of parsed.pitchClasses) {
      histogram[pc] =
        (histogram[pc] as number) +
        duration * (pc === parsed.root ? ROOT_WEIGHT : CHORD_TONE_WEIGHT)
    }
  }
  return histogram
}

export function noteHistogram(
  notes: readonly Pick<Note, 'pitch_midi' | 'onset_s' | 'offset_s'>[],
): number[] {
  const histogram = new Array<number>(12).fill(0)
  for (const note of notes) {
    const pc = note.pitch_midi % 12
    histogram[pc] = (histogram[pc] as number) + Math.max(0, note.offset_s - note.onset_s)
  }
  return histogram
}

// Profile correlation over 24 keys; confidence = softmax margin between the best two keys.
export function estimateKey(
  segments: readonly ChordSegment[],
  notes: readonly Pick<Note, 'pitch_midi' | 'onset_s' | 'offset_s'>[] = [],
): KeyEstimate {
  const chordsH = normalise(chordHistogram(segments))
  const notesH = normalise(noteHistogram(notes))
  const histogram = chordsH.map((v, i) => v + NOTES_WEIGHT * (notesH[i] as number))
  if (histogram.every((v) => v === 0)) {
    return { tonic: 'C', mode: 'major', confidence: 0, tonicPc: 0, ranking: [] }
  }
  const ranking: KeyEstimate['ranking'] = []
  for (const mode of ['major', 'minor'] as const) {
    const profile = mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE
    for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
      const rotated = histogram.map((_, i) => histogram[(i + tonicPc) % 12] as number)
      ranking.push({ tonicPc, mode, correlation: pearson(rotated, profile) })
    }
  }
  ranking.sort((a, b) => b.correlation - a.correlation)
  const best = ranking[0] as KeyEstimate['ranking'][number]
  const exps = ranking.map((r) =>
    Math.exp((r.correlation - best.correlation) / SOFTMAX_TEMPERATURE),
  )
  const total = exps.reduce((a, b) => a + b, 0)
  const confidence = ((exps[0] as number) - (exps[1] as number)) / total
  const flat = best.mode === 'major' ? FLAT_MAJOR.has(best.tonicPc) : FLAT_MINOR.has(best.tonicPc)
  return {
    tonic: pcName(best.tonicPc, flat ? 'flat' : 'sharp'),
    mode: best.mode,
    confidence: Math.min(1, Math.max(0, confidence)),
    tonicPc: best.tonicPc,
    ranking,
  }
}
