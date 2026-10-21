import { createSHA256 } from 'hash-wasm'

// SHA-256 of a picked file's bytes (13 §2 step 4), streamed so a 500 MB file never sits in memory
// at once. Posts progress (bytes hashed) and then the hex digest.
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const hasher = await createSHA256()
    hasher.init()
    const reader = event.data.stream().getReader()
    let hashed = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      hasher.update(value)
      hashed += value.byteLength
      self.postMessage({ type: 'progress', hashed })
    }
    self.postMessage({ type: 'done', sha256: hasher.digest('hex') })
  } catch {
    self.postMessage({ type: 'error' })
  }
}
