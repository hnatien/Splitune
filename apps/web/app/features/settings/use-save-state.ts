import { useEffect, useRef, useState } from 'react'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVED_VISIBLE_MS = 3_000

/** Per-field save feedback (27 §3.9): saving → saved (fades back after a few seconds) | error. */
export function useSaveState() {
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const run = async (save: () => unknown) => {
    clearTimeout(timer.current)
    setState('saving')
    try {
      await save()
      setState('saved')
      timer.current = setTimeout(() => setState('idle'), SAVED_VISIBLE_MS)
    } catch {
      setState('error')
    }
  }
  return { state, run }
}
