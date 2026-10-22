// The practice outboxes in IndexedDB (12 §4, 13 §5): correction ops and practice sessions and
// attempts made on this device wait here until the API has them, so edits and passes survive a
// reload or a dead connection. Separate from the uploads database, which has its own version.

const DB_NAME = 'splitune-practice'
export const STORES = ['corrections', 'sessions', 'attempts'] as const
export type StoreName = (typeof STORES)[number]

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function createOutboxDb(factory: IDBFactory | undefined = globalThis.indexedDB) {
  let db: Promise<IDBDatabase> | undefined
  const open = () => {
    if (!factory) return Promise.reject(new Error('IndexedDB is not available'))
    db ??= (() => {
      const req = factory.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        for (const store of STORES) req.result.createObjectStore(store, { keyPath: 'id' })
      }
      return request(req)
    })()
    return db
  }
  const store = async (name: StoreName, mode: IDBTransactionMode) =>
    (await open()).transaction(name, mode).objectStore(name)
  return {
    async all<T>(name: StoreName): Promise<T[]> {
      return request((await store(name, 'readonly')).getAll()) as Promise<T[]>
    },
    async put<T extends { id: string }>(name: StoreName, value: T): Promise<void> {
      await request((await store(name, 'readwrite')).put(value))
    },
    async delete(name: StoreName, ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return
      const objects = await store(name, 'readwrite')
      await Promise.all(ids.map((id) => request(objects.delete(id))))
    },
  }
}

export type OutboxDb = ReturnType<typeof createOutboxDb>

// Storage can be missing (private modes): outboxes then live for the page only.
export async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work()
  } catch {
    return fallback
  }
}
