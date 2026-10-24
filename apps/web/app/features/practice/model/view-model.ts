import {
  type BandThresholds,
  type ChordSegment,
  chordDisplayName,
  confidenceBand,
  parseChord,
  pcName,
} from '@splitune/music-core'
import type { BeatMarker, NoteMark } from '@splitune/notation'
import type { ConfidenceLevel } from '@splitune/ui-tokens'
import type { PracticeGrid } from './grid'
import type { MusicOutput } from './music'

// The renderer-agnostic view model (12 §2): what the chord strip, the notation, the timeline and
// the text alternative show, derived once from the effective music.

export interface ChordModel {
  id: string
  /** Display name, e.g. "Am7/G". */
  name: string
  /** Harte label, for the editor. */
  label: string
  bass?: string | undefined
  confidence: ConfidenceLevel
  t0: number
  t1: number
  bar: number
  beat: number
  /** Other candidates, most likely first, with their probability. */
  alternatives: { label: string; name: string; prob: number }[]
}

export interface NoteModel {
  id: string
  onset: number
  offset: number
  pitch: number
  confidence: ConfidenceLevel
  bar: number
  beat: number
  string?: number | undefined
  fret?: number | undefined
}

export interface ViewModel {
  chords: ChordModel[]
  notes: NoteModel[]
  marks: Map<string, NoteMark>
  markers: BeatMarker[]
  /** Bars whose notes are mostly unsure (timeline hatching, 26 §5). */
  unsureBars: Set<number>
}

export function noteName(midi: number): string {
  return `${pcName(((midi % 12) + 12) % 12, 'sharp')}${Math.floor(midi / 12) - 1}`
}

/** A pitch named in the song's key with its octave (E♭4, not D#4), with ♭ and ♯ glyphs. */
export function spelledNote(midi: number, names: readonly string[]): string {
  const name = names[((midi % 12) + 12) % 12] ?? pcName(((midi % 12) + 12) % 12, 'sharp')
  return `${name.replace('b', '♭').replace('#', '♯')}${Math.floor(midi / 12) - 1}`
}

export function buildViewModel(music: MusicOutput, grid: PracticeGrid): ViewModel {
  const bands: BandThresholds = music.bands
  const confidence = (c: number) => confidenceBand(c, bands)
  // Spelled for the song's key: E♭maj7 in E♭ major, not the model's D#maj7.
  const names = music.noteNames
  const chords: ChordModel[] = music.displayChords.flatMap((segment: ChordSegment) => {
    const parsed = parseChord(segment.label)
    if (parsed === null || parsed.kind !== 'chord') return []
    const at = grid.positionAt(segment.t0 + 1e-6)
    return [
      {
        id: segment.id,
        name: chordDisplayName(segment.label, segment.bass, names),
        label: segment.label,
        bass: segment.bass,
        confidence: confidence(segment.confidence),
        t0: segment.t0,
        t1: segment.t1,
        bar: at.bar,
        beat: at.beat,
        alternatives: segment.top_k
          .filter((k) => k.label !== segment.label && parseChord(k.label)?.kind === 'chord')
          .map((k) => ({
            label: k.label,
            name: chordDisplayName(k.label, undefined, names),
            prob: k.prob,
          })),
      },
    ]
  })

  const tab = music.tab
  const events = new Map((tab?.events ?? []).map((e) => [e.note_id, e]))
  const residual = new Set(tab?.residualFlagged ?? [])
  const notes: NoteModel[] = (tab?.notes ?? []).map((note) => {
    const event = events.get(note.id)
    const at = grid.positionAt(note.onset_s + 1e-6)
    return {
      id: note.id,
      onset: note.onset_s,
      offset: note.offset_s,
      pitch: note.pitch_midi,
      confidence: confidence(note.confidence),
      bar: event?.bar ?? at.bar,
      beat: event?.beat ?? at.beat,
      string: event?.string,
      fret: event?.fret,
    }
  })

  const marks = new Map<string, NoteMark>()
  const markers: BeatMarker[] = []
  for (const note of notes) {
    const event = events.get(note.id)
    const mark: NoteMark = { level: note.confidence }
    if (residual.has(note.id)) mark.timingFlagged = true
    if (event?.unplayable && event.string !== undefined && event.fret !== undefined && tab) {
      const placed = (tab.tuningMidi[event.string - 1] ?? 0) + event.fret
      mark.octave = placed > note.pitch ? '8va' : '8vb'
    } else if (event?.unplayable) {
      markers.push({ noteId: note.id, time: note.onset, label: '!' })
    }
    marks.set(note.id, mark)
  }

  const byBar = new Map<number, ConfidenceLevel[]>()
  for (const note of notes) byBar.set(note.bar, [...(byBar.get(note.bar) ?? []), note.confidence])
  const unsureBars = new Set(
    [...byBar]
      .filter(([, levels]) => levels.filter((l) => l === 'low').length * 2 > levels.length)
      .map(([bar]) => bar),
  )
  return { chords, notes, marks, markers, unsureBars }
}

/** The chord sounding at a time, and the next one. */
export function chordsAround(
  chords: readonly ChordModel[],
  seconds: number,
): { current: ChordModel | undefined; next: ChordModel | undefined; index: number } {
  let lo = 0
  let hi = chords.length - 1
  let index = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const chord = chords[mid] as ChordModel
    if (chord.t0 <= seconds) {
      index = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  const candidate = chords[index]
  const current = candidate && seconds < candidate.t1 ? candidate : undefined
  return { current, next: chords[index + 1], index }
}

export function chordsInBar(chords: readonly ChordModel[], grid: PracticeGrid, bar: number) {
  const start = grid.barStart(bar)
  const end = grid.barEnd(bar)
  return chords.filter((c) => c.t1 > start + 1e-3 && c.t0 < end - 1e-3)
}
