import type { OutboxDb, StoreName } from './outbox-db'

/** An in-memory outbox for tests (Node has no IndexedDB). */
export function memoryOutbox(): OutboxDb & { rows: Map<string, unknown> } {
  const rows = new Map<string, unknown>()
  const key = (store: StoreName, id: string) => `${store}:${id}`
  return {
    rows,
    all: async <T>(store: StoreName) =>
      [...rows.entries()].filter(([k]) => k.startsWith(`${store}:`)).map(([, v]) => v) as T[],
    put: async (store, value) => {
      rows.set(key(store, value.id), value)
    },
    delete: async (store, ids) => {
      for (const id of ids) rows.delete(key(store, id))
    },
  }
}
