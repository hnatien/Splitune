import type { PlayerState } from '@splitune/contracts'
import type { z } from 'zod'
import { CSRF_HEADER, client } from '@/lib/api'
import { apiFetch } from '@/lib/api-fetch'

// Resume state (13 §5): speed, mix, view, position and the selected clip, sent whole with a
// debounced PATCH /v1/songs/{id}; a page that goes away sends what's pending with keepalive.

export type ResumeState = z.infer<typeof PlayerState>

const DEBOUNCE_MS = 1000

export function createResumeWriter(songId: string) {
  let pending: ResumeState | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const send = async () => {
    timer = undefined
    const state = pending
    pending = undefined
    if (!state) return
    try {
      await client.songs.update({ id: songId, player_state: state })
    } catch {
      // Not saved: the next change sends the whole state again.
    }
  }
  return {
    write(state: ResumeState) {
      pending = state
      clearTimeout(timer)
      timer = setTimeout(() => void send(), DEBOUNCE_MS)
    },
    /** Sends now (pagehide): fetch keepalive outlives the page. */
    flush() {
      if (!pending) return
      clearTimeout(timer)
      timer = undefined
      const body = JSON.stringify({ player_state: pending })
      pending = undefined
      void apiFetch(
        new Request(`/v1/songs/${songId}`, {
          method: 'PATCH',
          body,
          keepalive: true,
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', [CSRF_HEADER]: '1' },
        }),
      ).catch(() => undefined)
    },
    cancel() {
      clearTimeout(timer)
      pending = undefined
    },
  }
}
