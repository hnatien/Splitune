import {
  applyBeatCorrections,
  applyChordCorrections,
  type BandThresholds,
  type Beats,
  type BuildTabResult,
  buildMelody,
  buildPianoScore,
  buildTab,
  type ChordSegment,
  type Chords,
  type CorrectionOp,
  DEFAULT_BANDS,
  keyNoteNames,
  keyScale,
  type Melody,
  type Notes,
  type PianoNote,
  type PianoScore,
  simplifyChords,
  type TabLevel,
} from '@splitune/music-core'
import { z } from 'zod'
import { defaultLevel, levelsFor } from './levels'

// The effective music of a song (12 §4, 07): artefacts ⊕ corrections, then music-core's tab (or,
// for piano, the hand-split notes of the roll; for vocals, the melody and its phrases) and display chords for the chosen capo, level and
// fingering. Pure, so it runs in the Worker
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
    input.notes && instrument === 'vocals'
      ? buildMelody(input.notes, input.beats, corrections, { ...extra, bands })
      : undefined
  const piano =
    input.notes && instrument === 'piano'
      ? buildPianoScore(input.notes, input.beats, corrections, { ...extra, bands })
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
