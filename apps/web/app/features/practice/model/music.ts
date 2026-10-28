import {
  applyBeatCorrections,
  applyChordCorrections,
  type BandThresholds,
  type Beats,
  type BuildTabResult,
  buildDrumScore,
  buildMelody,
  buildPianoScore,
  buildTab,
  type ChordSegment,
  type Chords,
  type CorrectionOp,
  DEFAULT_BANDS,
  type DrumLevel,
  type DrumNotes,
  type DrumScoreHit,
  keyNoteNames,
  keyScale,
  type Melody,
  type Notes,
  type PianoNote,
  type PianoScore,
  simplifyChords,
  type TabLevel,
} from '@splitune/music-core'
import type { NoteRef } from '@splitune/notation'
import { z } from 'zod'
import { defaultLevel, levelsFor, type PracticeLevel } from './levels'

// The effective music of a song (12 §4, 07): artefacts ⊕ corrections, then music-core's tab (or,
// for piano, the hand-split notes of the roll; for vocals, the melody and its phrases; for drums,
// the hits of the grid and the drum staff) and display chords for the chosen capo, level and
// fingering. Pure, so it runs in the Worker
// (music.worker.ts) and in tests; nothing here touches the DOM.

export type Fingering = 'easiest' | 'as_played'

export interface MusicOptions {
  capo: number
  level: PracticeLevel
  fingeringMode: Fingering
}

export interface MusicInput {
  beats: Beats
  chords?: Chords | undefined
  /** Absent until the notes stage is done, or for chords-only songs. Drums: notes.drums. */
  notes?: Notes | DrumNotes | undefined
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

export interface MusicStaff {
  alphaTex: string
  firstBar: number
  noteMap: PianoScore['noteMap']
}

export interface MusicOutput {
  beats: Beats
  chords?: Chords | undefined
  /** Labels as shown at this level (sevenths simplified to triads where the level says so). */
  displayChords: ChordSegment[]
  tab?: MusicTab | undefined
  /** Piano notes on the beat grid with their hands (21 V4): the falling-notes roll and the grand
   * staff's alphaTex. */
  piano?: { notes: PianoNote[]; staff: MusicStaff } | undefined
  /** Drums at the chosen level: hits on the beat grid (the drum grid) and the drum staff (step 25). */
  drums?:
    | {
        level: DrumLevel
        hits: DrumScoreHit[]
        fillBars: number[]
        staff: { alphaTex: string; firstBar: number; noteMap: NoteRef[] }
      }
    | undefined
  /** Vocals: the sung notes on their own timing, their phrases and the singer's range (step 18c). */
  melody?: (Pick<Melody, 'notes' | 'phrases' | 'range'> & { scale: number[] }) | undefined
  bands: BandThresholds
  /** Every pitch class's name in the song's key (C major's without one): E♭, not D#. */
  noteNames: string[]
}

// Spelled here, in the Worker, so the key speller stays out of the route's JS (12 §10).
const namesFor = (chords: Chords | undefined) =>
  keyNoteNames(chords?.key ?? { tonic: 'C', mode: 'major' })

// The notes stage records the calibration bands it used (as finalize reads them, 08).
const RecordedBands = z.object({
  calibration: z.object({
    bands: z.object({ high: z.number().min(0).max(1), medium: z.number().min(0).max(1) }),
  }),
})

function bandsOf(notes: Notes | DrumNotes | undefined): BandThresholds {
  const parsed = RecordedBands.safeParse(notes?.params)
  return parsed.success ? parsed.data.calibration.bands : DEFAULT_BANDS
}

const DRUM_LEVELS: readonly PracticeLevel[] = levelsFor('drums')

export function computeMusic(input: MusicInput): MusicOutput {
  const bands = bandsOf(input.notes)
  if (input.notes && 'hits' in input.notes) return drumMusic(input, input.notes, bands)
  const notes = input.notes
  const instrument = notes?.instrument
  if (notes && (instrument === 'guitar' || instrument === 'bass')) {
    const level = (
      levelsFor(instrument).includes(input.options.level)
        ? input.options.level
        : defaultLevel(instrument)
    ) as TabLevel
    const built = buildTab(
      notes,
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
      noteNames: namesFor(built.effective.chords),
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
  const corrections = { notes: input.ops.notes, beats: input.ops.beats, chords: input.ops.chords }
  const extra = input.chords ? { chords: input.chords } : {}
  const melody =
    notes && instrument === 'vocals'
      ? buildMelody(notes, input.beats, corrections, { ...extra, bands })
      : undefined
  const piano =
    notes && instrument === 'piano'
      ? buildPianoScore(notes, input.beats, corrections, { ...extra, bands })
      : undefined
  const effective = piano?.effective ?? melody?.effective
  const beats = effective?.beats ?? applyBeatCorrections(input.beats, input.ops.beats).value
  const chords =
    effective?.chords ??
    (input.chords && applyChordCorrections(input.chords, input.ops.chords).value)
  return {
    beats,
    chords,
    // Without a tab the level only simplifies the chords (piano's "Simple": triads).
    displayChords: chords
      ? simplifyChords(
          chords.segments,
          input.options.level === 'simplified' ? 'simplified' : 'as_transcribed',
        )
      : [],
    ...(piano
      ? {
          piano: {
            notes: piano.notes,
            staff: {
              alphaTex: piano.alphaTex,
              firstBar: piano.alphaTexFirstBar,
              noteMap: piano.noteMap,
            },
          },
        }
      : {}),
    ...(melody
      ? {
          melody: {
            notes: melody.notes,
            phrases: melody.phrases,
            range: melody.range,
            scale: keyScale(chords?.key ?? { tonic: 'C', mode: 'major' }),
          },
        }
      : {}),
    bands,
    noteNames: namesFor(chords),
  }
}

// Drums: the hits at the chosen level and their staff. The level changes the hits only; the chords
// stay as detected.
function drumMusic(input: MusicInput, drums: DrumNotes, bands: BandThresholds): MusicOutput {
  const level = (
    DRUM_LEVELS.includes(input.options.level) ? input.options.level : defaultLevel('drums')
  ) as DrumLevel
  const score = buildDrumScore(drums, input.beats, { beats: input.ops.beats }, { bands, level })
  const chords = input.chords && applyChordCorrections(input.chords, input.ops.chords).value
  return {
    beats: score.effective.beats,
    chords,
    displayChords: chords?.segments ?? [],
    drums: {
      level: score.level,
      hits: score.hits,
      fillBars: score.fillBars,
      staff: {
        alphaTex: score.alphaTex,
        firstBar: score.alphaTexFirstBar,
        noteMap: score.hitMap.map(({ hitId, ...at }) => ({ noteId: hitId, ...at })),
      },
    },
    bands,
    noteNames: namesFor(chords),
  }
}
