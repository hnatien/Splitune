import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { MixDefault } from './model/mixer'

// The mixer's settings kept on this device (27 §3.7.4): "Use as default for {part}" (a mix per
// instrument, which new songs of that part and Reset mix start from) and the click's level.

export const CLICK_RANGE = { min: -30, max: 6 } as const

interface MixerPrefs {
  defaults: Partial<Record<string, MixDefault>>
  clickDb: number
  setDefault: (instrument: string, mix: MixDefault) => void
  setClickDb: (db: number) => void
}

export const MIXER_PREFS_KEY = 'splitune-mixer'

export const useMixerPrefs = create<MixerPrefs>()(
  persist(
    (set) => ({
      defaults: {},
      clickDb: 0,
      setDefault: (instrument, mix) =>
        set((state) => ({ defaults: { ...state.defaults, [instrument]: mix } })),
      setClickDb: (db) =>
        set({ clickDb: Math.min(CLICK_RANGE.max, Math.max(CLICK_RANGE.min, Math.round(db))) }),
    }),
    {
      name: MIXER_PREFS_KEY,
      storage: createJSONStorage(() => {
        try {
          return localStorage
        } catch {
          return sessionStorage
        }
      }),
      partialize: ({ defaults, clickDb }) => ({ defaults, clickDb }),
    },
  ),
)
