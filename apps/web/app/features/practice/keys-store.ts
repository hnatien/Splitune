import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type Action, KEYS_STORAGE_KEY, type LearnedKeys, learn } from './model/keymap'

// Learned pedal keys, per device (12 §8 "Learn this pedal"). `learning` is the action waiting for
// its key: the next keydown anywhere binds it.

interface KeysStore {
  learned: LearnedKeys
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
      partialize: ({ learned }) => ({ learned }),
      // The stored object is the bare map (read defensively by readLearnedKeys too).
      merge: (persisted, current) => ({
        ...current,
        learned: ((persisted as { learned?: LearnedKeys } | undefined)?.learned ??
          {}) as LearnedKeys,
      }),
    },
  ),
)
