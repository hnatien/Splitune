import {
  applyBeatCorrections,
  applyChordCorrections,
  type BandThresholds,
  type Beats,
  type BuildTabResult,
  buildTab,
  type ChordSegment,
  type Chords,
  type CorrectionOp,
  DEFAULT_BANDS,
  type Notes,
  simplifyChords,
  type TabLevel,
} from '@splitune/music-core'
import { z } from 'zod'
import { defaultLevel, levelsFor } from './levels'

// The effective music of a song (12 §4, 07): artefacts ⊕ corrections, then music-core's tab and
// display chords for the chosen capo, level and fingering. Pure, so it runs in the Worker
// (music.worker.ts) and in tests; nothing here touches the DOM.

export type Fingering = 'easiest' | 'as_played'

export interface MusicOptions {
  capo: number
  level: TabLevel
  fingeringMode: Fingering
}

export interface MusicInput {
  beats: Beats
  chords?: Chords | undefined
  /** Absent until the notes stage is done, or for chords-only songs. */
  notes?: Notes | undefined
  ops: { beats: CorrectionOp[]; chords: CorrectionOp[]; notes: CorrectionOp[] }
  beatsRev: number
  options: MusicOptions
}

export interface MusicTab {
  alphaTex: string
  firstBar: number
  noteMap: BuildTabResult['noteMap']
  events: BuildTabResult['tab']['events']
  tuningMidi: number[]
  capo: number
  residualFlagged: string[]
  warnings: BuildTabResult['warnings']
  notes: Notes['notes']
}

export interface MusicOutput {
  beats: Beats
  chords?: Chords | undefined
  /** Labels as shown at this level (sevenths simplified to triads where the level says so). */
  displayChords: ChordSegment[]
  tab?: MusicTab | undefined
  bands: BandThresholds
}

// The notes stage records the calibration bands it used (as finalize reads them, 08).
const RecordedBands = z.object({
  calibration: z.object({
    bands: z.object({ high: z.number().min(0).max(1), medium: z.number().min(0).max(1) }),
  }),
})

function bandsOf(notes: Notes | undefined): BandThresholds {
  const parsed = RecordedBands.safeParse(notes?.params)
  return parsed.success ? parsed.data.calibration.bands : DEFAULT_BANDS
}

export function computeMusic(input: MusicInput): MusicOutput {
  const bands = bandsOf(input.notes)
  const instrument = input.notes?.instrument
  if (input.notes && (instrument === 'guitar' || instrument === 'bass')) {
    const level = levelsFor(instrument).includes(input.options.level)
      ? input.options.level
      : defaultLevel(instrument)
    const built = buildTab(
      input.notes,
      input.beats,
      {
        notes: input.ops.notes,
        beats: input.ops.beats,
        chords: input.ops.chords,
        beatsRev: input.beatsRev,
      },
      {
        ...(input.chords ? { chords: input.chords } : {}),
        capo: input.options.capo,
        level,
        fingeringMode: input.options.fingeringMode,
        bands,
        // Chord names sit over the bar where they change, as in every tab players know.
        chordNames: true,
      },
    )
    return {
      beats: built.effective.beats,
      chords: built.effective.chords,
      displayChords: built.displayChords,
      bands,
      tab: {
        alphaTex: built.alphaTex,
        firstBar: built.alphaTexFirstBar,
        noteMap: built.noteMap,
        events: built.tab.events,
        tuningMidi: built.tab.tuning_midi,
        capo: built.tab.capo,
        residualFlagged: built.residualFlagged,
        warnings: built.warnings,
        notes: built.effective.notes.notes,
      },
    }
  }
  const beats = applyBeatCorrections(input.beats, input.ops.beats).value
  const chords = input.chords && applyChordCorrections(input.chords, input.ops.chords).value
  return {
    beats,
    chords,
    displayChords: chords ? simplifyChords(chords.segments, 'as_transcribed') : [],
    bands,
  }
}
