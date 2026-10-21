import { useEffect } from 'react'
import { displayPreferences, useDisplay } from '@/lib/display-store'
import { applyDisplay } from '@/ui/display'

const SYSTEM_QUERIES = [
  '(prefers-color-scheme: dark)',
  '(prefers-contrast: more)',
  '(prefers-reduced-motion: reduce)',
  '(pointer: coarse)',
]

// Keeps <html>'s data-* attributes in step with the per-device store (26 §2): on every change,
// and when the OS setting behind a "System" choice changes. The inline head script did the first
// paint before this runs.
export function DisplaySync() {
  useEffect(() => {
    const apply = () =>
      applyDisplay(displayPreferences(useDisplay.getState()), document.documentElement, (q) =>
        window.matchMedia(q),
      )
    apply()
    const unsubscribe = useDisplay.subscribe(apply)
    const lists = SYSTEM_QUERIES.map((q) => window.matchMedia(q))
    for (const list of lists) list.addEventListener('change', apply)
    return () => {
      unsubscribe()
      for (const list of lists) list.removeEventListener('change', apply)
    }
  }, [])
  return null
}
