import { type BandThresholds, DEFAULT_BANDS } from '../calibration/lookup.ts'
import { type BeatGrid, beatLabel, PPQ, timeToTick } from '../grid/beatgrid.ts'
import { parseChord, simplifyToTriad } from '../harmony/chordtools.ts'
import { STRAIGHT_STEP } from '../quantize/quantize.ts'
import type { ChordSegment } from '../types.ts'

// Level simplification (07-music-algorithms.md §6). Deterministic; the UI explains each rule.

export type GuitarLevel = 'chords_only' | 'simplified' | 'as_transcribed'
export type BassLevel = 'roots' | 'full'

export interface LevelNote {
  id: string
  pitch: number
  confidence: number
  onTick: number
  offTick: number
}

// chords_only: no notes (chord strip + diagrams). simplified: only notes with confidence ≥ medium
// that start on a beat, which also leaves at most one onset per beat. as_transcribed: unchanged.
export function simplifyGuitar<T extends LevelNote>(
  notes: readonly T[],
  level: GuitarLevel,
  bands: BandThresholds = DEFAULT_BANDS,
): T[] {
  if (level === 'chords_only') return []
  if (level === 'as_transcribed') return [...notes]
  return notes.filter((n) => n.confidence >= bands.medium && n.onTick % PPQ === 0)
}

// Chord labels shown at a level: `simplified` drops sevenths, extensions and inversions.
export function simplifyChords(
  segments: readonly ChordSegment[],
  level: GuitarLevel | BassLevel,
): ChordSegment[] {
  if (level !== 'simplified') return [...segments]
  return segments.map((s) => {
    const { bass: _bass, ...rest } = s
    return { ...rest, label: simplifyToTriad(s.label) }
  })
}

export interface RootNote extends LevelNote {
  segmentId: string
}

// Bass `roots`: one root (or slash bass) per chord segment on each downbeat inside it; a segment
// without a downbeat gets one note at its first beat. The octave follows the octave-corrected bass
// notes sounding in the segment (E1–D#2 register when there are none). Ids are
// `root:{segment_id}@{bar}` because these notes do not exist in notes.bass.
export function bassRoots(
  segments: readonly ChordSegment[],
  grid: BeatGrid,
  bassNotes: readonly { pitch: number; onTick: number }[],
  range: { lowest: number; highest: number },
): RootNote[] {
  const out: RootNote[] = []
  for (const segment of segments) {
    const parsed = parseChord(segment.label)
    if (parsed === null || parsed.kind !== 'chord') continue
    const pc = parsed.bassPc ?? parsed.root
    const startTick = timeToTick(grid, segment.t0)
    const endTick = Math.max(timeToTick(grid, segment.t1), startTick)
    const firstBeat = Math.ceil(startTick / PPQ - 1e-9) + 0 // + 0 turns -0 into 0
    const lastBeat = Math.ceil(endTick / PPQ - 1e-9) - 1
    const beats: number[] = []
    for (let b = firstBeat; b <= lastBeat; b++) if (beatLabel(grid, b).beat === 1) beats.push(b)
    if (beats.length === 0)
      beats.push(firstBeat <= lastBeat ? firstBeat : Math.round(startTick / PPQ))
    const sounding = bassNotes
      .filter((n) => n.onTick >= startTick && n.onTick < endTick)
      .map((n) => n.pitch)
    const reference =
      sounding.length > 0
        ? (sounding.sort((a, b) => a - b)[sounding.length >> 1] as number)
        : range.lowest + 6
    let pitch = range.lowest + ((pc - (range.lowest % 12) + 12) % 12)
    while (
      pitch + 12 <= range.highest &&
      Math.abs(pitch + 12 - reference) < Math.abs(pitch - reference)
    )
      pitch += 12
    const segmentEnd = Math.max(Math.round(endTick / STRAIGHT_STEP) * STRAIGHT_STEP, 0)
    beats.forEach((b, k) => {
      const onTick = b * PPQ
      const next = beats[k + 1]
      const offTick = Math.max(onTick + STRAIGHT_STEP, next === undefined ? segmentEnd : next * PPQ)
      out.push({
        id: `root:${segment.id}@${beatLabel(grid, b).bar}`,
        segmentId: segment.id,
        pitch,
        confidence: segment.confidence,
        onTick,
        offTick,
      })
    })
  }
  return out
}
