type Message =
  | { type: 'progress'; hashed: number }
  | { type: 'done'; sha256: string }
  | { type: 'error' }

/** Hashes the file in a Worker; rejects if the browser can't read it. */
export function hashFile(file: File, onProgress?: (hashed: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<Message>) => {
      const message = event.data
      if (message.type === 'progress') onProgress?.(message.hashed)
      else {
        worker.terminate()
        if (message.type === 'done') resolve(message.sha256)
        else reject(new Error('file could not be read'))
      }
    }
    worker.onerror = () => {
      worker.terminate()
      reject(new Error('hash worker failed'))
    }
    worker.postMessage(file)
  })
}
