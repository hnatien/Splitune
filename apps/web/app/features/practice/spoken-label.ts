import { useEffect, useRef, useState } from 'react'

/**
 * A screen-reader label that follows `text`: at once while stopped, and at most once every
 * `everyMs` while playing. A throttle, not a debounce: text that changes faster than that (a note
 * every beat) still lands on the next tick instead of resetting the wait forever.
 */
export function useSpokenLabel(text: string, audio: { playing(): boolean }, everyMs: number) {
  const [label, setLabel] = useState('')
  const latest = useRef(text)
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    latest.current = text
    if (!audio.playing()) {
      clearTimeout(pending.current)
      pending.current = undefined
      setLabel(text)
      return
    }
    if (pending.current !== undefined) return
    pending.current = setTimeout(() => {
      pending.current = undefined
      setLabel(latest.current)
    }, everyMs)
  }, [text, audio, everyMs])
  useEffect(() => () => clearTimeout(pending.current), [])
  return label
}
