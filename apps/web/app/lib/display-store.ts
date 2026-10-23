import type { RestBetween } from '@splitune/contracts'
import type { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { DEFAULT_DISPLAY, DISPLAY_STORAGE_KEY, type DisplayPreferences } from '@/ui/display'

// Per-device preferences (10 §3, 26 §2): display choices drive the data-* attributes on <html>;
// practice defaults seed new practice sessions (step 12). Both live in localStorage on this
// device only. The display key holds the bare preferences object because the inline head script
// reads it before any JavaScript bundle loads.

export const PRACTICE_STORAGE_KEY = 'splitune.practice'

export type PracticeDefaults = {
  /** Starting speed in % of the original (doc 13 §1: 70 % for "just started"). */
  speedPct: number
  countInBars: number
  restBetween: z.infer<typeof RestBetween>
  /** Confidence outlines and "?" glyphs on the score (the ink stays, 26 §5). */
  showUncertainty: boolean
  /** Stop after each pass until "Felt clean" / "Not yet" is chosen (12 §6 Assess). */
  passPrompt: boolean
  /** Tab layout: page-flip by bar group, or continuous scroll under a fixed now-line (12 §3). */
  notationLayout: 'page' | 'scroll'
  /** How late this device's output is heard beyond what the browser reports (Bluetooth, 11 §3). */
  soundDelayMs: number
  /** Master volume of the practice player, 0–100 %. */
  volumePct: number
  /** Piano chord chart: right hand led smoothly from chord to chord, or each in root position. */
  pianoVoicing: 'smooth' | 'root'
  /** Piano chord chart: hands shown on the keyboard. */
  pianoHands: 'both' | 'right'
}

/** The engine clamps its display offset to ±150 ms (`MAX_DISPLAY_OFFSET`, 11 §3). */
export const MAX_SOUND_DELAY_MS = 150

export const DEFAULT_PRACTICE: PracticeDefaults = {
  speedPct: 100,
  countInBars: 1,
  restBetween: 'none',
  showUncertainty: true,
  passPrompt: false,
  notationLayout: 'page',
  soundDelayMs: 0,
  volumePct: 100,
  pianoVoicing: 'smooth',
  pianoHands: 'both',
}

// Storage can be missing (SSR) or throw (privacy modes, blocked storage): preferences then last
// for the page's lifetime only.
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value)
    } catch {
      // Not persisted; the in-memory value still applies.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name)
    } catch {
      // Nothing stored.
    }
  },
}

// zustand's persist wraps state as { state, version }; this storage keeps the bare object.
const bareStorage = createJSONStorage<Partial<DisplayPreferences>>(() => ({
  getItem: (name) => {
    const raw = safeLocalStorage.getItem(name) as string | null
    if (raw === null) return null
    try {
      return JSON.stringify({ state: JSON.parse(raw), version: 0 })
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    const { state } = JSON.parse(value) as { state: Partial<DisplayPreferences> }
    safeLocalStorage.setItem(name, JSON.stringify(state))
  },
  removeItem: (name) => safeLocalStorage.removeItem(name),
}))

type DisplayStore = DisplayPreferences & { update: (patch: Partial<DisplayPreferences>) => void }

export const useDisplay = create<DisplayStore>()(
  persist((set) => ({ ...DEFAULT_DISPLAY, update: (patch) => set(patch) }), {
    name: DISPLAY_STORAGE_KEY,
    storage: bareStorage,
    partialize: ({ update: _update, ...preferences }) => preferences,
  }),
)

type PracticeStore = PracticeDefaults & { update: (patch: Partial<PracticeDefaults>) => void }

export const usePracticeDefaults = create<PracticeStore>()(
  persist((set) => ({ ...DEFAULT_PRACTICE, update: (patch) => set(patch) }), {
    name: PRACTICE_STORAGE_KEY,
    storage: createJSONStorage(() => safeLocalStorage),
    partialize: ({ update: _update, ...defaults }) => defaults,
  }),
)

/** The stored display preferences without the store's methods. */
export function displayPreferences(state: DisplayStore): DisplayPreferences {
  const { update: _update, ...preferences } = state
  return preferences
}
