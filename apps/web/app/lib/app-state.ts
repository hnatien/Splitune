import { create } from 'zustand'

// App-wide transient state the shells read. Whether practice audio is playing (or counting in,
// resting between passes), for what must wait until it stops: the "A new version is ready" reload
// never happens mid-practice (27 §3.11). And the PWA's update (lib/pwa.ts, loaded later, fills it
// in): whether a new version waits to take over, and how to let it.

export const usePlaybackActive = create<{ active: boolean }>(() => ({ active: false }))

export const usePwa = create<{
  updateReady: boolean
  applyUpdate: () => void
  /** Keeps a page reached by client-side navigation for offline use. */
  cachePage: (href: string) => void
}>(() => ({
  updateReady: false,
  applyUpdate: () => undefined,
  cachePage: () => undefined,
}))

/**
 * Safari on iOS and iPadOS installs only through Share → Add to Home Screen, and it is the one
 * browser with `navigator.standalone` (feature detection, 24 §4): false there means not installed.
 */
export function canAddToHomeScreen(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === false
}
