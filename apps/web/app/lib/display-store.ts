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

// The option lists Settings → Display & practice and the practice Display popover map over (D13),
// so a value added here shows in both without either changing.

/** "Notation follows the music" (12 §3): Page by page (default), Scrolling, Off. */
export const FOLLOW_MODES = ['page', 'scroll', 'off'] as const
export type FollowMode = (typeof FOLLOW_MODES)[number]

/** Playhead style (12 §3): a 2 px line, a small block on the beat, or the current bar shaded. */
export const PLAYHEAD_STYLES = ['line', 'block', 'bar'] as const
export type PlayheadStyle = (typeof PLAYHEAD_STYLES)[number]

/** Piano hands shown (27 §3.7.5): the other hand is drawn at 45 %, the audio is unchanged. */
export const PIANO_HANDS = ['both', 'left', 'right'] as const
export type PianoHands = (typeof PIANO_HANDS)[number]

/** The appearances offered as choices (26 §2, D2): `stage` stays valid but isn't one. */
export const APPEARANCE_CHOICES = ['dark', 'light', 'system'] as const

export type PracticeDefaults = {
  /** Starting speed in % of the original (doc 13 §1: 70 % for "just started"). */
  speedPct: number
  countInBars: number
  restBetween: z.infer<typeof RestBetween>
  /** Confidence outlines and "?" glyphs on the score (the ink stays, 26 §5). */
  showUncertainty: boolean
  /** Stop after each pass until "Felt clean" / "Not yet" is chosen (12 §6 Assess). */
  passPrompt: boolean
  /** A new loop starts with the speed ladder on (27 §3.9, 12 §5). Off until the learner asks
   * for it (owner, s37): the ladder slows a loop down and counts in before each pass. */
  ladderNewLoops: boolean
  /** Clean passes before the ladder moves up a step (D3: 3; the contract allows 1–20). */
  ladderCleanPasses: number
  /** Notation follows the music (12 §3): page turns, continuous scroll under a fixed now-line,
   * or not at all (reading and fixing). Reduced motion allows Page only. */
  notationLayout: FollowMode
  /** How the playhead is drawn on the notation (12 §3). */
  playhead: PlayheadStyle
  /** How late this device's output is heard beyond what the browser reports (Bluetooth, 11 §3). */
  soundDelayMs: number
  /** Master volume of the practice player, 0–100 %. */
  volumePct: number
  /** Piano chord chart: right hand led smoothly from chord to chord, or each in root position. */
  pianoVoicing: 'smooth' | 'root'
  /** Piano: the hand shown at full strength (the other at 45 %), or both. */
  pianoHands: PianoHands
  /** Vocal Melody: what the notes say (note names, scale degrees or nothing). */
  melodyLabels: 'names' | 'degrees' | 'off'
  /** Vocal Melody: the pitch window follows what's on screen, or holds the whole song. */
  melodyWindow: 'follow' | 'whole'
}

/** The engine clamps its display offset to ±150 ms (`MAX_DISPLAY_OFFSET`, 11 §3). */
export const MAX_SOUND_DELAY_MS = 150

export const DEFAULT_PRACTICE: PracticeDefaults = {
  speedPct: 100,
  countInBars: 1,
  restBetween: 'none',
  showUncertainty: true,
  passPrompt: false,
  ladderNewLoops: false,
  ladderCleanPasses: 3,
  notationLayout: 'page',
  playhead: 'line',
  soundDelayMs: 0,
  volumePct: 100,
  pianoVoicing: 'smooth',
  pianoHands: 'both',
  melodyLabels: 'names',
  melodyWindow: 'follow',
}

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value)

/**
 * Stored practice defaults from any earlier shape: unknown keys go, values outside today's option
 * lists fall back to the defaults (an old `notationLayout`, `pianoHands: 'right'` stays, a missing
 * `playhead` is Line), so a device never loads a value no control can show.
 */
export function sanitizePractice(stored: unknown): Partial<PracticeDefaults> {
  if (stored === null || typeof stored !== 'object') return {}
  const raw = stored as Record<string, unknown>
  const out: Partial<PracticeDefaults> = {}
  const number = (key: keyof PracticeDefaults, min: number, max: number) => {
    const value = raw[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      ;(out as Record<string, number>)[key] = Math.min(max, Math.max(min, value))
    }
  }
  const flag = (key: keyof PracticeDefaults) => {
    if (typeof raw[key] === 'boolean') (out as Record<string, boolean>)[key] = raw[key]
  }
  const choice = <T extends string>(key: keyof PracticeDefaults, options: readonly T[]) => {
    if (isOneOf(options, raw[key])) (out as Record<string, T>)[key] = raw[key]
  }
  number('speedPct', 25, 110)
  number('countInBars', 0, 4)
  choice('restBetween', ['none', 'beat', 'bar'] as const)
  flag('showUncertainty')
  flag('passPrompt')
  flag('ladderNewLoops')
  number('ladderCleanPasses', 1, 20)
  choice('notationLayout', FOLLOW_MODES)
  choice('playhead', PLAYHEAD_STYLES)
  number('soundDelayMs', -MAX_SOUND_DELAY_MS, MAX_SOUND_DELAY_MS)
  number('volumePct', 0, 100)
  choice('pianoVoicing', ['smooth', 'root'] as const)
  choice('pianoHands', PIANO_HANDS)
  choice('melodyLabels', ['names', 'degrees', 'off'] as const)
  choice('melodyWindow', ['follow', 'whole'] as const)
  return out
}

type Distance = NonNullable<DisplayPreferences['distance']>

/**
 * The `stage` → `dark` rewrite (26 §2): a device with `stage` stored shows Night Rehearsal and the
 * distance it resolved to; the next change to the appearance or the distance stores `dark` (unless
 * that change picks another appearance) and the distance shown (unless it picks one). Other
 * changes leave `stage` as it is.
 */
export function rewriteStage(
  stored: Pick<DisplayPreferences, 'appearance' | 'distance'>,
  patch: Partial<DisplayPreferences>,
  resolvedDistance: Distance,
): Partial<DisplayPreferences> {
  if (stored.appearance !== 'stage') return patch
  // Only a real change counts: putting back what was there (onboarding's Skip) keeps `stage`.
  const touchesAppearance = patch.appearance !== undefined && patch.appearance !== 'stage'
  const touchesDistance = 'distance' in patch && patch.distance !== stored.distance
  if (!touchesAppearance && !touchesDistance) return patch
  const appearance = touchesAppearance && patch.appearance ? patch.appearance : 'dark'
  const distance = touchesDistance ? patch.distance : (stored.distance ?? resolvedDistance)
  return { ...patch, appearance, distance }
}

/** The distance <html> resolved to; Music stand where nothing is applied yet (`stage`'s floor). */
function appliedDistance(): Distance {
  const applied = globalThis.document?.documentElement.getAttribute('data-distance')
  return applied === 'desk' || applied === 'floor' ? applied : 'stand'
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
  persist(
    (set, get) => ({
      ...DEFAULT_DISPLAY,
      update: (patch) => set(rewriteStage(get(), patch, appliedDistance())),
    }),
    {
      name: DISPLAY_STORAGE_KEY,
      storage: bareStorage,
      partialize: ({ update: _update, ...preferences }) => preferences,
    },
  ),
)

type PracticeStore = PracticeDefaults & { update: (patch: Partial<PracticeDefaults>) => void }

export const usePracticeDefaults = create<PracticeStore>()(
  persist((set) => ({ ...DEFAULT_PRACTICE, update: (patch) => set(patch) }), {
    name: PRACTICE_STORAGE_KEY,
    storage: createJSONStorage(() => safeLocalStorage),
    partialize: ({ update: _update, ...defaults }) => defaults,
    // Whatever shape an earlier version stored, only today's values load (sanitizePractice).
    merge: (persisted, current) => ({ ...current, ...sanitizePractice(persisted) }),
  }),
)

/** The stored display preferences without the store's methods. */
export function displayPreferences(state: DisplayStore): DisplayPreferences {
  const { update: _update, ...preferences } = state
  return preferences
}
