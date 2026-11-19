import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// The optional Weekly goal (27 §3.7.4, §5.5): off by default, a number of days a week, kept on
// this device only. No reminders, no streaks; the tab says how many days this week have practice.

interface GoalStore {
  on: boolean
  days: number
  setOn: (on: boolean) => void
  setDays: (days: number) => void
}

export const GOAL_STORAGE_KEY = 'splitune-weekly-goal'

export const useWeeklyGoal = create<GoalStore>()(
  persist(
    (set) => ({
      on: false,
      days: 3,
      setOn: (on) => set({ on }),
      setDays: (days) => set({ days: Math.min(7, Math.max(1, Math.round(days))) }),
    }),
    {
      name: GOAL_STORAGE_KEY,
      storage: createJSONStorage(() => {
        try {
          return localStorage
        } catch {
          return sessionStorage
        }
      }),
      partialize: ({ on, days }) => ({ on, days }),
    },
  ),
)
