import { useSyncExternalStore } from 'react'

const subscribe = () => () => undefined

/**
 * False on the server and while the page hydrates, true from the first client render after: for
 * output that depends on the browser, such as dates in the learner's time zone (lib/format.ts).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
