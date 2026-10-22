import { computeMusic, type MusicInput, type MusicOutput } from './music'

// music-core off the main thread (07: re-quantize + re-fret within the 150 ms budget). One
// request in, one answer out, tagged with the request id; `ms` is the compute time.

export type MusicRequest = { id: number; input: MusicInput }
export type MusicResponse =
  | { id: number; ok: true; output: MusicOutput; ms: number }
  | { id: number; ok: false; message: string }

self.onmessage = (event: MessageEvent<MusicRequest>) => {
  const { id, input } = event.data
  const started = performance.now()
  try {
    const output = computeMusic(input)
    self.postMessage({
      id,
      ok: true,
      output,
      ms: performance.now() - started,
    } satisfies MusicResponse)
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    } satisfies MusicResponse)
  }
}
