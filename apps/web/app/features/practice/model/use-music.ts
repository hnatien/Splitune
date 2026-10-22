import { useEffect, useRef, useState } from 'react'
import type { MusicInput, MusicOutput } from './music'
import type { MusicRequest, MusicResponse } from './music.worker'

// The effective music from the Worker (07, 12 §4), recomputed when an input it depends on
// changes (artefact versions, corrections, capo, level, fingering) and memoised by that key.

let worker: Worker | undefined
let next = 0
const waiting = new Map<number, (response: MusicResponse) => void>()

function compute(input: MusicInput): Promise<MusicResponse> {
  worker ??= (() => {
    const created = new Worker(new URL('./music.worker.ts', import.meta.url), { type: 'module' })
    created.onmessage = (event: MessageEvent<MusicResponse>) => {
      waiting.get(event.data.id)?.(event.data)
      waiting.delete(event.data.id)
    }
    return created
  })()
  const id = ++next
  return new Promise((resolve) => {
    waiting.set(id, resolve)
    worker?.postMessage({ id, input } satisfies MusicRequest)
  })
}

export interface MusicState {
  music: MusicOutput | undefined
  /** Worker compute time of the latest result (ms). */
  computeMs: number | undefined
  /** Time from the change to the result (ms): capo/level budget is 300 ms with the render. */
  requestedAt: number | undefined
  failed: boolean
}

export function useMusic(input: MusicInput | undefined, key: string): MusicState {
  const [state, setState] = useState<MusicState>({
    music: undefined,
    computeMs: undefined,
    requestedAt: undefined,
    failed: false,
  })
  const latest = useRef(0)
  const inputRef = useRef(input)
  inputRef.current = input
  useEffect(() => {
    const current = inputRef.current
    if (!current || key === '') return
    const request = ++latest.current
    const requestedAt = performance.now()
    void compute(current).then((response) => {
      if (request !== latest.current) return
      setState(
        response.ok
          ? { music: response.output, computeMs: response.ms, requestedAt, failed: false }
          : (previous) => ({ ...previous, failed: true }),
      )
    })
  }, [key])
  return state
}
