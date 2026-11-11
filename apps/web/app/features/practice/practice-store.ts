import { create } from 'zustand'
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

function rememberTab(tab: InspectorTab) {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab)
  } catch {
    // Remembered for this page only.
  }
}

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
  /** The inspector's open tab (desktop), and whether its drawer is open below 1180 px. */
  tab: InspectorTab
  inspectorOpen: boolean
  /** The Display and reading popover (opened from the top bar or ⌘K). */
  displayOpen: boolean
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
  mixerOpen: false,
  shortcutsOpen: false,
  tab: 'loop',
  inspectorOpen: false,
  displayOpen: false,
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

/** Opens an inspector tab (and its drawer where the inspector is one), remembered per device. */
export function openTab(tab: InspectorTab) {
  rememberTab(tab)
  usePracticeUi.setState({ tab, inspectorOpen: true })
}
