// The light entry: types, the chord, keyboard and fretboard diagrams, the falling-notes roll and
// the guitar lanes. The alphaTab view and its helpers live in `@splitune/notation/view`, loaded
// lazily on the practice route (12 §10: alphaTab outside the route's JS budget).

export type { AlphaTabViewHandle, AlphaTabViewProps, Clock } from './alphatab-view.tsx'
export { ChordDiagram, type ChordDiagramProps } from './chord-diagram.tsx'
export type { MediaTarget } from './external-media.ts'
export {
  type FretKey,
  type FretNote,
  type FretWindow,
  fitReadPx,
  fretKeys,
  fretWindowAt,
  groupAfter,
  labelPx,
  type NoteGroup,
  noteGroups,
  STRUM_S,
  stringRows,
} from './fretboard.ts'
export {
  FretboardDiagram,
  type FretboardDiagramProps,
  type FretPosition,
} from './fretboard-diagram.tsx'
export {
  GuitarRoll,
  type GuitarRollProps,
  type GuitarRollTheme,
  rollStretches,
} from './guitar-roll.tsx'
export {
  KeyboardDiagram,
  type KeyboardDiagramProps,
  type KeyboardKey,
  keyboardKeys,
} from './keyboard-diagram.tsx'
export {
  PianoRoll,
  type PianoRollProps,
  type RollBand,
  type RollNote,
  type RollTheme,
  rollRange,
  rollWindow,
  soundingNotes,
} from './piano-roll.tsx'
export type { ScoreTheme } from './resources.ts'
export type * from './types.ts'
