import type {
  CorrectionOp,
  Instrument,
  Level,
  LoopClip,
  PlayerState,
  PracticeAttemptInput,
  PracticeSessionInput,
} from '@splitune/contracts'
import type { z } from 'zod'
import { markGuestProgress } from './marker'

// What a visitor makes before signing up (13 §1): their onboarding answers, loops, passes,
// edits and resume state on the example songs, in IndexedDB until the first sign-in claims them
// (claim.ts); marker.ts flags that there is some. Without IndexedDB (some private modes) everything lives for the page only.

const DB_NAME = 'splitune-guest'
const STORES = ['profile', 'loops', 'players', 'sessions', 'attempts', 'corrections'] as const
type StoreName = (typeof STORES)[number]
const KEY_PATH: Record<StoreName, string> = {
  profile: 'id',
  loops: 'id',
  players: 'song_id',
  sessions: 'client_session_id',
  attempts: 'client_attempt_id',
  corrections: 'client_op_id',
}

export interface GuestProfile {
  id: 'me'
  instrument: z.infer<typeof Instrument> | null
  level: z.infer<typeof Level> | null
  /** When the visitor first opened /start, for time-to-first-loop (16 §2). */
  landedAt: number
}

export type GuestLoop = z.infer<typeof LoopClip>
export interface GuestPlayer {
  song_id: string
  player_state: z.infer<typeof PlayerState>
}
export type GuestSession = z.infer<typeof PracticeSessionInput>
export type GuestAttempt = z.infer<typeof PracticeAttemptInput>
export interface GuestCorrection {
  client_op_id: string
  artefact_id: string
  rev: number
  op: z.infer<typeof CorrectionOp>
  created_at: string
}

interface Rows {
  profile: GuestProfile
  loops: GuestLoop
  players: GuestPlayer
  sessions: GuestSession
  attempts: GuestAttempt
  corrections: GuestCorrection
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function createGuestStore(factory: IDBFactory | undefined = globalThis.indexedDB) {
  let db: Promise<IDBDatabase> | undefined
  // The page-only fallback, and what is read when IndexedDB fails.
  const memory = new Map<StoreName, Map<string, unknown>>(STORES.map((s) => [s, new Map()]))
  const open = () => {
    if (!factory) return Promise.reject(new Error('IndexedDB is not available'))
    db ??= (() => {
      const req = factory.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        for (const store of STORES) {
          req.result.createObjectStore(store, { keyPath: KEY_PATH[store] })
        }
      }
      return request(req)
    })()
    return db
  }
  const store = async (name: StoreName, mode: IDBTransactionMode) =>
    (await open()).transaction(name, mode).objectStore(name)
  const keyOf = <S extends StoreName>(name: S, row: Rows[S]) =>
    String((row as unknown as Record<string, unknown>)[KEY_PATH[name]])

  return {
    async all<S extends StoreName>(name: S): Promise<Rows[S][]> {
      try {
        return (await request((await store(name, 'readonly')).getAll())) as Rows[S][]
      } catch {
        return [...(memory.get(name)?.values() ?? [])] as Rows[S][]
      }
    },
    async put<S extends StoreName>(name: S, row: Rows[S]): Promise<void> {
      memory.get(name)?.set(keyOf(name, row), row)
      if (name !== 'profile') markGuestProgress()
      try {
        await request((await store(name, 'readwrite')).put(row))
      } catch {
        // Kept in memory for this page (see above).
      }
    },
    async delete(name: StoreName, keys: readonly string[]): Promise<void> {
      for (const key of keys) memory.get(name)?.delete(key)
      if (keys.length === 0) return
      try {
        const objects = await store(name, 'readwrite')
        await Promise.all(keys.map((key) => request(objects.delete(key))))
      } catch {
        // Nothing stored to delete.
      }
    },
  }
}

export type GuestStore = ReturnType<typeof createGuestStore>

export const guestStore = createGuestStore()
