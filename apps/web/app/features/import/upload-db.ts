import type { AnalysisType, Instrument } from '@splitune/contracts'
import type { z } from 'zod'

// The resume token of a browser upload (13 §2 step 5): the upload's ids, the parts S3 already
// acknowledged with their ETags and — when the browser can store it — the file itself, so a reload
// mid-transfer continues with the missing parts instead of starting over.

export type PendingUpload = {
  uploadId: string
  songId: string
  title: string
  instrument: z.infer<typeof Instrument>
  type: z.infer<typeof AnalysisType>
  fileSha256: string
  bytes: number
  partSize: number
  parts: { n: number; etag: string }[]
  file?: File | undefined
  createdAt: number
}

const DB_NAME = 'splitune'
const STORE = 'uploads'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  const req = factory.open(DB_NAME, 1)
  req.onupgradeneeded = () => {
    req.result.createObjectStore(STORE, { keyPath: 'uploadId' })
  }
  return request(req)
}

export function createUploadDb(factory: IDBFactory | undefined = globalThis.indexedDB) {
  let db: Promise<IDBDatabase> | undefined
  const store = async (mode: IDBTransactionMode) => {
    if (!factory) throw new Error('IndexedDB is not available')
    db ??= open(factory)
    return (await db).transaction(STORE, mode).objectStore(STORE)
  }
  return {
    async put(upload: PendingUpload): Promise<void> {
      await request((await store('readwrite')).put(upload))
    },
    async get(uploadId: string): Promise<PendingUpload | undefined> {
      return request((await store('readonly')).get(uploadId))
    },
    async all(): Promise<PendingUpload[]> {
      return request((await store('readonly')).getAll())
    },
    /** Records one acknowledged part: read-modify-write inside one transaction's callbacks. */
    async addPart(uploadId: string, part: { n: number; etag: string }): Promise<void> {
      const objects = await store('readwrite')
      await new Promise<void>((resolve, reject) => {
        const read = objects.get(uploadId)
        read.onerror = () => reject(read.error)
        read.onsuccess = () => {
          const current = read.result as PendingUpload | undefined
          if (!current) return resolve()
          const parts = [...current.parts.filter((p) => p.n !== part.n), part]
          const write = objects.put({ ...current, parts })
          write.onerror = () => reject(write.error)
          write.onsuccess = () => resolve()
        }
      })
    },
    async delete(uploadId: string): Promise<void> {
      await request((await store('readwrite')).delete(uploadId))
    },
  }
}

export type UploadDb = ReturnType<typeof createUploadDb>
