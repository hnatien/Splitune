// The light entry: types, the chord and keyboard diagrams and the falling-notes roll. The alphaTab view and its helpers
// live in `@splitune/notation/view`, loaded lazily on the practice route (12 §10: alphaTab outside
// the route's JS budget).

export type { AlphaTabViewHandle, AlphaTabViewProps, Clock } from './alphatab-view.tsx'
export { ChordDiagram, type ChordDiagramProps } from './chord-diagram.tsx'
export type { MediaTarget } from './external-media.ts'
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
