import {
  parseChord,
  type Spelling,
  shapeDifficulty,
  transposeChord,
  transposeNoteName,
  tuningOffset,
} from '../harmony/chordtools.ts'
import type { ChordSegment } from '../types.ts'

// Playback key (pitch shift of the audio, in semitones) and shapes key (capo) are separate
// (07-music-algorithms.md §7, Pattern 4 in ux/practice-tool-patterns.md).

export function transposeSegments(
  segments: readonly ChordSegment[],
  semitones: number,
  spelling: Spelling = 'auto',
): ChordSegment[] {
  if (semitones === 0) return [...segments]
  return segments.map((s) => {
    const shifted: ChordSegment = {
      ...s,
      label: parseChord(s.label) === null ? s.label : transposeChord(s.label, semitones, spelling),
      top_k: s.top_k.map((k) => ({
        ...k,
        label:
          parseChord(k.label) === null ? k.label : transposeChord(k.label, semitones, spelling),
      })),
    }
    if (s.bass !== undefined) shifted.bass = transposeNoteName(s.bass, semitones, spelling)
    return shifted
  })
}

export interface ShapeResolution {
  capo: number
  keepShapes: boolean // false when the requested capo would leave 0–12 and frets are recomputed
}

// With `keepShapes`, the learner keeps the same fingering and the capo moves with the playback
// shift; otherwise the capo stays and the fret DP re-runs on the shifted pitches.
export function resolveShapes(
  capo: number,
  semitones: number,
  keepShapes: boolean,
): ShapeResolution {
  if (!keepShapes || semitones === 0) return { capo, keepShapes: keepShapes && semitones === 0 }
  const moved = capo + semitones
  return moved >= 0 && moved <= 12 ? { capo: moved, keepShapes: true } : { capo, keepShapes: false }
}

export interface CapoSuggestion {
  capo: number
  cost: number // summed shape difficulty over the chord segments (open 1, barre 3, other 4)
  shapes: Record<string, string> // sounding label → label played in the shapes key
}

// Scores capo 0–maxCapo by the difficulty of the shapes needed and ranks them (cheapest first,
// lower capo on ties). Returns [] for tunings the standard shape library does not cover.
export function suggestCapo(
  segments: readonly ChordSegment[],
  options: { tuningMidi?: readonly number[]; maxCapo?: number } = {},
): CapoSuggestion[] {
  const offset = options.tuningMidi === undefined ? 0 : tuningOffset(options.tuningMidi)
  if (offset === null) return []
  const maxCapo = options.maxCapo ?? 7
  const labels = segments
    .map((s) => s.label)
    .filter((l) => {
      const parsed = parseChord(l)
      return parsed !== null && parsed.kind === 'chord'
    })
  const out: CapoSuggestion[] = []
  for (let capo = 0; capo <= maxCapo; capo++) {
    const shapes: Record<string, string> = {}
    let cost = 0
    for (const label of labels) {
      const played = transposeChord(label, -(capo + offset))
      shapes[label] = played
      cost += shapeDifficulty(played)
    }
    out.push({ capo, cost, shapes })
  }
  return out.sort((a, b) => a.cost - b.cost || a.capo - b.capo)
}
