import { create } from 'zustand'
import type { LoopSelection } from './model/loops'

// Practice screen UI state that isn't the player's (12 §2): loop selection in progress, which
// overlay is open, the editor target, the pass prompt and the PedalHud message. One practice
// screen exists at a time; the provider resets this on mount.

export type EditorTarget = {
  kind: 'bar'
  bar: number
  chordId?: string | undefined
  noteId?: string | undefined
} | null

export interface PracticeUi {
  selection: LoopSelection
  editor: EditorTarget
  mixerOpen: boolean
  shortcutsOpen: boolean
  /** The pass whose "Felt clean / Not yet" is being asked (0 = none). */
  promptPass: number
  /** The Loop button or key was used with no loop: the hint on how to pick bars shows. */
  loopHint: boolean
  hud: { message: string | null; sequence: number }
  /** The header's Tab / Notes / Chords choice (piano: Chart / Notes / Staff, its Notes the roll);
   * null is the layout's default (glance on phone portrait). */
  view: 'tab' | 'notes' | 'staff' | 'chords' | null
  /** "Show tab anyway" over a chords-only recommendation. */
  forceTab: boolean
  /** A URL import's video in its floating player (closed by default), and at its larger size. */
  videoOpen: boolean
  videoLarge: boolean
  /** Bar the count-in or metronome is on, for the visual beat counter. */
  beat: { index: number; accent: boolean; countIn: boolean } | null
  /** The screen can't be kept on here (no Wake Lock, or refused): the tip shows (24 §3). */
  screenMayLock: boolean
}

export const INITIAL_UI: PracticeUi = {
  selection: { kind: 'none' },
  editor: null,
  mixerOpen: false,
  shortcutsOpen: false,
  promptPass: 0,
  loopHint: false,
  hud: { message: null, sequence: 0 },
  view: null,
  forceTab: false,
  videoOpen: false,
  videoLarge: false,
  beat: null,
  screenMayLock: false,
}

export const usePracticeUi = create<PracticeUi>()(() => INITIAL_UI)

export function showHud(message: string) {
  usePracticeUi.setState((state) => ({ hud: { message, sequence: state.hud.sequence + 1 } }))
}
