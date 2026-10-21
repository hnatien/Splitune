// Capability probe (10 §5, 24 §3): feature detection run once per page and cached. Only
// AudioWorklet and WebAssembly fixed-width SIMD are hard requirements; everything else picks a
// fallback path. UA tokens are read only to show the in-app-browser banner, never to block.

export type Capabilities = {
  audioWorklet: boolean
  wasmSimd: boolean
  webCodecsAudio: boolean
  mediaRecorder: boolean
  getUserMedia: boolean
  wakeLock: boolean
  mediaSession: boolean
  webMidi: boolean
  opfs: boolean
}

export type Requirement = 'audioWorklet' | 'wasmSimd'

// wasm-feature-detect's SIMD module: a function returning v128 (i8x16.splat, i8x16.popcnt). It
// validates only where fixed-width SIMD is supported.
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  253, 98, 11,
])

let cached: Capabilities | undefined

export function probeCapabilities(scope: typeof globalThis = globalThis): Capabilities {
  if (cached && scope === globalThis) return cached
  const nav = scope.navigator as Navigator | undefined
  const result: Capabilities = {
    audioWorklet: typeof scope.AudioWorkletNode === 'function',
    wasmSimd: typeof scope.WebAssembly?.validate === 'function' && WebAssembly.validate(SIMD_PROBE),
    webCodecsAudio: typeof scope.AudioDecoder === 'function',
    mediaRecorder: typeof scope.MediaRecorder === 'function',
    getUserMedia: typeof nav?.mediaDevices?.getUserMedia === 'function',
    wakeLock: Boolean(nav && 'wakeLock' in nav),
    mediaSession: Boolean(nav && 'mediaSession' in nav),
    webMidi: Boolean(nav && 'requestMIDIAccess' in nav),
    opfs: typeof nav?.storage?.getDirectory === 'function',
  }
  if (scope === globalThis) cached = result
  return result
}

/** The hard requirements this browser lacks (empty = supported). */
export function missingRequirements(capabilities: Capabilities): Requirement[] {
  return (['audioWorklet', 'wasmSimd'] as const).filter((name) => !capabilities[name])
}

// WebViews of social apps restrict file pickers, audio sessions and storage (24 §4).
const IN_APP_BROWSER =
  /\b(?:FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Bytedance|Line\/|Snapchat|Twitter|Pinterest|LinkedInApp)\b/i

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_BROWSER.test(userAgent)
}
