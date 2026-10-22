import type { CorrectionOp } from '@splitune/contracts'
import type { QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { create } from 'zustand'
import { client, errorCode, orpc } from '@/lib/api'
import { uuidv7 } from '@/lib/uuid'
import { createOutboxDb, type OutboxDb, safely } from './outbox-db'

// Corrections (12 §4, 05 "Corrections overlay"): every edit is a CorrectionOp with a client_op_id,
// applied at once (optimistic) and sent to POST /v1/artefacts/{id}/corrections from an IndexedDB
// outbox; replays are idempotent server-side. Undo/redo is per session: an op still in the outbox
// is simply dropped, a sent one gets its inverse appended (the overlay is append-only).

export type Op = z.infer<typeof CorrectionOp>

export interface PendingOp {
  id: string // client_op_id
  artefactId: string
  op: Op
  at: number
}

interface HistoryEntry {
  artefactId: string
  op: Op
  inverse: Op | null
  clientOpId: string
}

type FlushError = 'rejected' | 'offline'

interface CorrectionsStore {
  pending: PendingOp[]
  undo: HistoryEntry[]
  redo: HistoryEntry[]
  /** Ops the API refused (contract errors): rolled back with an inline notice (26 §13). */
  rejected: number
  hydrated: boolean
}

export const useCorrections = create<CorrectionsStore>()(() => ({
  pending: [],
  undo: [],
  redo: [],
  rejected: 0,
  hydrated: false,
}))

let outbox: OutboxDb = createOutboxDb()
let queryClient: QueryClient | undefined
let flushing: Promise<void> | undefined
let again = false
let retry: ReturnType<typeof setTimeout> | undefined

/** For tests: another database (fake-indexeddb) and Query client. */
export function configureCorrections(options: { db?: OutboxDb; queryClient?: QueryClient }) {
  if (options.db) outbox = options.db
  if (options.queryClient) queryClient = options.queryClient
}

export async function hydrateCorrections(): Promise<void> {
  if (useCorrections.getState().hydrated) return
  const stored = await safely(() => outbox.all<PendingOp>('corrections'), [])
  useCorrections.setState((state) => ({
    hydrated: true,
    pending: [
      ...stored.filter((s) => !state.pending.some((p) => p.id === s.id)),
      ...state.pending,
    ].sort((a, b) => a.at - b.at),
  }))
  if (stored.length > 0) void flushCorrections()
}

function enqueue(artefactId: string, op: Op): string {
  const pending: PendingOp = { id: uuidv7(), artefactId, op, at: Date.now() }
  useCorrections.setState((state) => ({ pending: [...state.pending, pending] }))
  void safely(() => outbox.put('corrections', pending), undefined).then(() => flushCorrections())
  return pending.id
}

/** Applies an edit. `inverse` undoes it (null: not undoable, e.g. "Report wrong"). */
export function applyCorrection(artefactId: string, op: Op, inverse: Op | null): void {
  const clientOpId = enqueue(artefactId, op)
  if (inverse === null) return
  useCorrections.setState((state) => ({
    undo: [...state.undo, { artefactId, op, inverse, clientOpId }],
    redo: [],
  }))
}

export function undoCorrection(): boolean {
  const entry = useCorrections.getState().undo.at(-1)
  if (!entry?.inverse) return false
  const queued = useCorrections.getState().pending.some((p) => p.id === entry.clientOpId)
  let clientOpId = entry.clientOpId
  if (queued) {
    useCorrections.setState((state) => ({
      pending: state.pending.filter((p) => p.id !== entry.clientOpId),
    }))
    void safely(() => outbox.delete('corrections', [entry.clientOpId]), undefined)
  } else {
    clientOpId = enqueue(entry.artefactId, entry.inverse)
  }
  useCorrections.setState((state) => ({
    undo: state.undo.slice(0, -1),
    redo: [...state.redo, { ...entry, clientOpId }],
  }))
  return true
}

export function redoCorrection(): boolean {
  const entry = useCorrections.getState().redo.at(-1)
  if (!entry) return false
  const clientOpId = enqueue(entry.artefactId, entry.op)
  useCorrections.setState((state) => ({
    redo: state.redo.slice(0, -1),
    undo: [...state.undo, { ...entry, clientOpId }],
  }))
  return true
}

/**
 * Sends the outbox, one batch per artefact, until nothing new is left (ops queued during a send go
 * in the next round); keeps what didn't get through for a retry.
 */
export function flushCorrections(): Promise<void> {
  if (flushing) {
    // A send is under way: it takes another round before it finishes.
    again = true
    return flushing
  }
  // Cleared in .finally: a round with nothing to send finishes before the assignment.
  flushing = (async () => {
    const tried = new Set<string>()
    for (;;) {
      again = false
      const pending = useCorrections.getState().pending.filter((p) => !tried.has(p.id))
      if (pending.length === 0 && !again) return
      let offline = false
      for (const artefactId of new Set(pending.map((p) => p.artefactId))) {
        const batch = pending.filter((p) => p.artefactId === artefactId).slice(0, 500)
        for (const p of batch) tried.add(p.id)
        if ((await sendBatch(artefactId, batch)) === 'offline') offline = true
      }
      if (offline) {
        scheduleRetry()
        return
      }
    }
  })().finally(() => {
    flushing = undefined
  })
  return flushing
}

async function sendBatch(artefactId: string, batch: PendingOp[]): Promise<FlushError | undefined> {
  if (batch.length === 0) return undefined
  try {
    await client.artefacts.applyCorrections({
      id: artefactId,
      ops: batch.map((p) => ({ client_op_id: p.id, op: p.op })),
    })
    // Ids the user already stored on another artefact aren't echoed back; done either way.
    await settle(
      artefactId,
      batch.map((p) => p.id),
    )
    return undefined
  } catch (error) {
    const code = errorCode(error)
    if (code === 'not_found' || code === 'invalid_input' || code === 'forbidden') {
      await settle(
        artefactId,
        batch.map((p) => p.id),
      )
      useCorrections.setState((state) => ({ rejected: state.rejected + batch.length }))
      return 'rejected'
    }
    return 'offline'
  }
}

async function settle(artefactId: string, ids: string[]) {
  // Refetch the server overlay first, so the edit never flickers out of the effective view.
  await queryClient?.invalidateQueries({
    queryKey: orpc.artefacts.listCorrections.queryKey({ input: { id: artefactId } }),
  })
  const done = new Set(ids)
  useCorrections.setState((state) => ({ pending: state.pending.filter((p) => !done.has(p.id)) }))
  await safely(() => outbox.delete('corrections', ids), undefined)
}

function scheduleRetry() {
  if (retry !== undefined) return
  retry = setTimeout(() => {
    retry = undefined
    void flushCorrections()
  }, 10_000)
}

/** Server ops (rev order) followed by this device's pending ops for one artefact. */
export function effectiveOps(
  server: readonly { client_op_id: string; op: Op }[],
  pending: readonly PendingOp[],
  artefactId: string | undefined,
): Op[] {
  if (!artefactId) return []
  const sent = new Set(server.map((s) => s.client_op_id))
  return [
    ...server.map((s) => s.op),
    ...pending.filter((p) => p.artefactId === artefactId && !sent.has(p.id)).map((p) => p.op),
  ]
}

export function dismissRejected() {
  useCorrections.setState({ rejected: 0 })
}
