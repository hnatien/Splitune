import { useCallback, useSyncExternalStore } from 'react'

/** A media query as state (feature queries for layout, never UA sniffing; 26 §7). */
export function useMediaQuery(query: string, serverValue = true): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}
