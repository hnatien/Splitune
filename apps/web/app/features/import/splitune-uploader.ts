import { BasePlugin, type PluginOpts, type Uppy } from '@uppy/core'
import type { Body, Meta, UppyFile } from '@uppy/core/utils'
import type { ApiClient } from '@/lib/api'
import type { UploadDb } from './upload-db'

// Uppy uploader for Splitune's presigned multipart flow (04 "Uploads", 17 §3). The API creates
// and completes the S3 multipart upload and signs every part with its exact Content-Length; the
// browser only PUTs parts and reads each part's ETag (bucket CORS exposes it). Acknowledged parts
// go to IndexedDB as they land, so a reload resumes with the missing ones.
//
// Uppy 6's AwsS3 plugin signs CreateMultipartUpload/CompleteMultipartUpload for the browser to
// call itself; that would move the server-side part check out of the API, hence this plugin.

export type UploadMeta = Meta & { uploadId: string; partSize: number }

type PartUrl = { n: number; url: string }

type Options = PluginOpts & {
  api: ApiClient
  store: UploadDb
  /** Part URLs the create call already returned, by upload id (used once, then refreshed). */
  initialUrls: Map<string, PartUrl[]>
  /** Parallel part PUTs per file. */
  concurrency?: number
}

const MAX_ATTEMPTS = 4
const BACKOFF_MS = 1_000

export class UploadAbortedError extends Error {}

class PartError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function putPart(
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (event) => onProgress(event.loaded)
    xhr.onload = () => {
      const etag = xhr.getResponseHeader('ETag')
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag)
      else reject(new PartError(xhr.status, etag ? 'part rejected' : 'ETag not readable'))
    }
    xhr.onerror = () => reject(new PartError(0, 'network error'))
    xhr.onabort = () => reject(new UploadAbortedError())
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function online(signal: AbortSignal): Promise<void> {
  if (navigator.onLine) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('online', done)
      resolve()
    }
    window.addEventListener('online', done)
    signal.addEventListener('abort', done, { once: true })
  })
}

export class SplituneUploader extends BasePlugin<Options, UploadMeta, Body> {
  #controllers = new Map<string, AbortController>()

  constructor(uppy: Uppy<UploadMeta, Body>, opts: Options) {
    super(uppy, opts)
    this.id = opts.id ?? 'SplituneUploader'
    this.type = 'uploader'
  }

  override install() {
    this.uppy.addUploader(this.#upload)
  }

  override uninstall() {
    this.uppy.removeUploader(this.#upload)
  }

  /** Stops a file's transfer; acknowledged parts stay in IndexedDB. */
  abort(fileId: string) {
    this.#controllers.get(fileId)?.abort()
  }

  #upload = async (fileIds: string[]) => {
    await Promise.all(fileIds.map((id) => this.#uploadFile(this.uppy.getFile(id))))
  }

  async #uploadFile(file: UppyFile<UploadMeta, Body>) {
    const controller = new AbortController()
    this.#controllers.set(file.id, controller)
    try {
      await this.#transfer(file, controller.signal)
      this.uppy.emit('upload-success', this.uppy.getFile(file.id), { status: 200, uploadURL: '' })
    } catch (error) {
      if (error instanceof UploadAbortedError) return
      this.uppy.emit('upload-error', this.uppy.getFile(file.id), error as Error)
    } finally {
      this.#controllers.delete(file.id)
    }
  }

  async #transfer(file: UppyFile<UploadMeta, Body>, signal: AbortSignal) {
    const { api, store, initialUrls, concurrency = 3 } = this.opts
    const { uploadId, partSize } = file.meta
    const data = file.data as Blob
    const total = data.size
    const partCount = Math.ceil(total / partSize)
    const sizeOf = (n: number) => (n < partCount ? partSize : total - (partCount - 1) * partSize)

    const done = new Map((await store.get(uploadId))?.parts.map((p) => [p.n, p.etag]) ?? [])
    const missing = Array.from({ length: partCount }, (_, i) => i + 1).filter((n) => !done.has(n))
    const urls = new Map((initialUrls.get(uploadId) ?? []).map((p) => [p.n, p.url]))
    initialUrls.delete(uploadId)
    const refresh = async (numbers: number[]) => {
      await online(signal)
      const { parts } = await api.uploads.refreshParts({ id: uploadId, part_numbers: numbers })
      for (const part of parts) urls.set(part.n, part.url)
    }
    if (missing.length > 0 && missing.some((n) => !urls.has(n))) await refresh(missing)

    const loaded = new Map<number, number>()
    const started = Date.now()
    const report = () => {
      let bytes = 0
      for (const n of done.keys()) bytes += sizeOf(n)
      for (const value of loaded.values()) bytes += value
      this.uppy.emit('upload-progress', this.uppy.getFile(file.id), {
        uploadStarted: started,
        bytesUploaded: Math.min(bytes, total),
        bytesTotal: total,
      })
    }
    report()

    const queue = [...missing]
    const worker = async () => {
      for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
        const start = (n - 1) * partSize
        const body = data.slice(start, start + sizeOf(n))
        for (let attempt = 1; ; attempt++) {
          await online(signal)
          if (signal.aborted) throw new UploadAbortedError()
          try {
            const url = urls.get(n)
            if (!url) throw new PartError(403, 'no signed URL')
            const part = n
            const etag = await putPart(
              url,
              body,
              (bytes) => {
                loaded.set(part, bytes)
                report()
              },
              signal,
            )
            loaded.delete(n)
            done.set(n, etag)
            await store.addPart(uploadId, { n, etag })
            report()
            break
          } catch (error) {
            loaded.delete(n)
            if (error instanceof UploadAbortedError || attempt >= MAX_ATTEMPTS) throw error
            // An expired or missing signature is re-signed; anything else is retried with backoff.
            if (error instanceof PartError && error.status === 403) await refresh([n])
            else await wait(BACKOFF_MS * 2 ** (attempt - 1))
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))

    await api.uploads.complete({
      id: uploadId,
      parts: [...done.entries()].sort(([a], [b]) => a - b).map(([n, etag]) => ({ n, etag })),
    })
  }
}
