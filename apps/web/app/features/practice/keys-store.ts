import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type Action, KEYS_STORAGE_KEY, type LearnedKeys, learn } from './model/keymap'

// Learned pedal keys and the single-key switch, per device (12 §8 "Learn this pedal", WCAG 2.1.4:
// Settings → Keyboard & pedal binds `singleKeys`). `learning` is the action waiting for its key:
// the next keydown anywhere binds it.

interface KeysStore {
  learned: LearnedKeys
  /** Character key shortcuts (C, N, L, `,` …); off, only chords, pedal keys and learned keys act. */
  singleKeys: boolean
  setSingleKeys: (on: boolean) => void
  learning: Action | null
  startLearning: (action: Action) => void
  bind: (key: string) => void
  cancel: () => void
  reset: () => void
}

export const useKeys = create<KeysStore>()(
  persist(
    (set, get) => ({
      learned: {},
      singleKeys: true,
      setSingleKeys: (on) => set({ singleKeys: on }),
      learning: null,
      startLearning: (action) => set({ learning: action }),
      bind: (key) => {
        const action = get().learning
        if (action) set({ learned: learn(get().learned, action, key), learning: null })
      },
      cancel: () => set({ learning: null }),
      reset: () => set({ learned: {}, learning: null }),
    }),
    {
      name: KEYS_STORAGE_KEY,
      storage: createJSONStorage(() => {
        try {
          return localStorage
        } catch {
          return sessionStorage
        }
      }),
      partialize: ({ learned, singleKeys }) => ({ learned, singleKeys }),
      merge: (persisted, current) => {
        const stored = persisted as { learned?: LearnedKeys; singleKeys?: unknown } | undefined
        return {
          ...current,
          learned: (stored?.learned ?? {}) as LearnedKeys,
          singleKeys: stored?.singleKeys !== false,
        }
      },
    },
  ),
)
