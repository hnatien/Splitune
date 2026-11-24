import { create } from 'zustand'
import type { FixListen } from './model/fix-listen'
import type { LoopSelection } from './model/loops'

// Practice screen UI state that isn't the player's (12 §2): loop selection in progress, which
// overlay is open, the inspector tab, the editor target, the pass prompt and the PedalHud message.
// One practice screen exists at a time; the provider resets this on mount.

/** The inspector's tabs (27 §3.7.4), in order. */
export const INSPECTOR_TABS = ['loop', 'mix', 'progress', 'fix'] as const
export type InspectorTab = (typeof INSPECTOR_TABS)[number]

const TAB_STORAGE_KEY = 'splitune.inspector-tab'

/** The tab this device used last (27 §3.7.1), Loop on a new device or where storage is blocked. */
export function rememberedTab(): InspectorTab {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY)
    return (INSPECTOR_TABS as readonly string[]).includes(stored ?? '')
      ? (stored as InspectorTab)
      : 'loop'
  } catch {
    return 'loop'
  }
}

// Fix is a mode with its own dock and loop (27 §3.7.4): it is entered, never resumed, so a new
// visit opens on the tab used before it.
function rememberTab(tab: InspectorTab) {
  if (tab === 'fix') return
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab)
  } catch {
    // Remembered for this page only.
  }
}

export type EditorTarget = {
  kind: 'bar'
  bar: number
  /** The last bar when the selection spans several (a chord held over bars). */
  endBar?: number | undefined
  chordId?: string | undefined
  noteId?: string | undefined
} | null

/** J / K (the next or previous unsure spot) or E (a bar), for Fix mode to act on. */
export type FixCommand = { kind: 'next' | 'previous' } | { kind: 'bar'; bar: number }

export interface PracticeUi {
  selection: LoopSelection
  /** What is selected in Fix: a bar with, when chosen, one of its chords or notes. */
  editor: EditorTarget
  /** Fix mode (27 §3.7.4): on while Fix is the inspector's tab. */
  fixing: boolean
  /** What the Fix dock plays over the selected bars. */
  fixListen: FixListen
  /** The last J / K / E, kept until Fix mode (loaded on demand) has taken it. */
  fixCommand: (FixCommand & { sequence: number }) | null
  /** "Show original": the transcription without the learner's edits (12 §4). */
  showOriginal: boolean
  /** "Hear the chords" (12 §7): a soft synth plays the transcribed chords with the song. */
  hearChords: boolean
  shortcutsOpen: boolean
  /** The tools panel's tab, and whether the panel is open (docked, a drawer or a sheet). */
  tab: InspectorTab
  inspectorOpen: boolean
  /** The Display and reading popover (opened from the top bar or ⌘K). */
  displayOpen: boolean
  /** The transport's speed panel (opened by its readout or by S, on its typed field). */
  speedOpen: boolean
  /** The pass whose "Felt clean / Not yet" is being asked (0 = none). */
  promptPass: number
  /** The Loop button or key was used with no loop: the hint on how to pick bars shows. */
  loopHint: boolean
  hud: Hud
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
  /** A pedal has been pressed on this screen: the transport shows what its two sides do now. */
  pedalSeen: boolean
}

/** The PedalHud's line (27 §3.7.4): "{source} · {action}", and "Set it up" for the pedal hint. */
export interface Hud {
  message: string | null
  sequence: number
  /** What pressed it ("Key ,", "Pedal"); none for taps and the app's own notices. */
  source?: string | undefined
  /** "Pedal detected? Set it up": the HUD links to the pedal setup. */
  setUp?: boolean | undefined
}

export const INITIAL_UI: PracticeUi = {
  selection: { kind: 'none' },
  editor: null,
  fixing: false,
  fixListen: 'original',
  fixCommand: null,
  showOriginal: false,
  hearChords: false,
  shortcutsOpen: false,
  tab: 'loop',
  inspectorOpen: false,
  displayOpen: false,
  speedOpen: false,
  promptPass: 0,
  loopHint: false,
  hud: { message: null, sequence: 0 },
  view: null,
  forceTab: false,
  videoOpen: false,
  videoLarge: false,
  beat: null,
  screenMayLock: false,
  pedalSeen: false,
}

export const usePracticeUi = create<PracticeUi>()(() => INITIAL_UI)

// The key or pedal behind the action running now (set by the input mapper for its synchronous
// call), so every confirmation an action shows names what pressed it.
let pressedBy: string | undefined

export function showHud(
  message: string,
  options: { source?: string | undefined; setUp?: boolean } = {},
) {
  const source = options.source ?? pressedBy
  usePracticeUi.setState((state) => ({
    hud: { message, sequence: state.hud.sequence + 1, source, setUp: options.setUp },
  }))
}

/** Runs a key or pedal action so its HUD line reads "{source} · {action}" (27 §3.7.4). */
export function pressedWith(source: string, run: () => void) {
  pressedBy = source
  try {
    run()
  } finally {
    pressedBy = undefined
  }
}

/** Opens an inspector tab (and its drawer where the inspector is one), remembered per device.
 * Fix is a mode: choosing it enters Fix mode, choosing another tab leaves it. */
export function openTab(tab: InspectorTab) {
  rememberTab(tab)
  usePracticeUi.setState(
    tab === 'fix'
      ? { tab, inspectorOpen: true, fixing: true }
      : { tab, inspectorOpen: true, fixing: false, editor: null, showOriginal: false },
  )
}

/** The view switch's choice (27 §3.7.5): a notation over a chords-only recommendation is "Show
 * tab anyway"; choosing the chords takes that back. */
export function chooseView(view: NonNullable<PracticeUi['view']>) {
  usePracticeUi.setState(
    view === 'chords' ? { view: 'chords', forceTab: false } : { view, forceTab: true },
  )
}

/** Enters Fix mode (if it isn't on) with a J / K / E for it to act on. */
export function fixCommand(command: FixCommand) {
  usePracticeUi.setState((state) => ({
    tab: 'fix',
    inspectorOpen: true,
    fixing: true,
    fixCommand: { ...command, sequence: (state.fixCommand?.sequence ?? 0) + 1 },
  }))
}

/** J / K for the touch editor sheet while it is open: the same command, without Fix mode (which
 * is the tools panel's, on screens that dock it). */
export function sheetCommand(command: FixCommand) {
  usePracticeUi.setState((state) => ({
    fixCommand: { ...command, sequence: (state.fixCommand?.sequence ?? 0) + 1 },
  }))
}

/** Done or Esc: back to the tab used before Fix. */
export function leaveFix() {
  openTab(rememberedTab())
}
