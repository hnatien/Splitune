import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import { collectErrors, openExample, projectContext, signIn, wav } from './helpers'

// Step 16, the fallback audit (24 §3): each capability that isn't universal is removed before the
// app's scripts run, and its fallback must work end to end. Missing hard requirements (24 §2) lead
// to the unsupported page instead, with the library still readable. The example song is played as
// a visitor (no sign-in); import and the unsupported page use one signed-in context.

declare global {
  interface Window {
    __workers: string[]
  }
}

/** Records the scripts of the Workers the page starts (the WebCodecs decode runs in one). */
function recordWorkers() {
  const Native = window.Worker
  window.__workers = []
  window.Worker = class extends Native {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options)
      window.__workers.push(String(url))
    }
  }
}

/** Every optional capability in 24 §3 the MVP uses, gone at once. */
function removeOptionalCapabilities() {
  const gone = (target: object, name: string) => {
    for (let o: object | null = target; o; o = Object.getPrototypeOf(o)) {
      Reflect.deleteProperty(o, name)
    }
  }
  gone(window, 'AudioDecoder')
  gone(AudioContext.prototype, 'outputLatency')
  gone(AudioContext.prototype, 'setSinkId')
  gone(navigator, 'wakeLock')
  gone(navigator, 'mediaSession')
  gone(navigator, 'audioSession')
  gone(navigator, 'requestMIDIAccess')
  // Opus can't be played here: stems must not depend on it (AAC for everyone, 24 §3).
  const canPlayType = HTMLMediaElement.prototype.canPlayType
  HTMLMediaElement.prototype.canPlayType = function (type: string) {
    return /opus|webm/i.test(type) ? '' : canPlayType.call(this, type)
  }
}

/** No WebCodecs, and the browser's own decoder fails too. */
function removeAllDecoders() {
  Reflect.deleteProperty(window, 'AudioDecoder')
  BaseAudioContext.prototype.decodeAudioData = () =>
    Promise.reject(new DOMException('Unable to decode audio data', 'EncodingError'))
}

function removeAudioWorklet() {
  Reflect.deleteProperty(window, 'AudioWorkletNode')
}

// The capability probe's module (lib/capabilities.ts) is the only one that fails to validate.
function removeWasmSimd() {
  const validate = WebAssembly.validate
  WebAssembly.validate = (bytes: BufferSource) => {
    const view = ArrayBuffer.isView(bytes)
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : new Uint8Array(bytes)
    // i8x16.splat / i8x16.popcnt: the SIMD opcodes of that 31-byte module.
    return view.length === 31 && view[26] === 253 ? false : validate(bytes)
  }
}

function removeMediaRecorder() {
  Reflect.deleteProperty(window, 'MediaRecorder')
}

const decodeWorkers = (page: Page) =>
  page.evaluate(() => window.__workers.filter((url) => /decode\.worker/.test(url)))

const loopBadge = (page: Page) => page.getByRole('button', { name: /^Loop · bars \d+–\d+/ })

/** A short AAC file in MP4 (what phones record and most downloads are), encoded by FFmpeg. */
function aac(seconds: number): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'splitune-e2e-aac-'))
  try {
    const out = join(dir, 'take.m4a')
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'wav', '-i', 'pipe:0', '-c:a', 'aac', out], {
      input: wav(seconds),
    })
    return readFileSync(out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test.describe('the example song, as a visitor', () => {
  test('primary paths: stems decode with WebCodecs in a Worker and the loop plays', async ({
    browser,
  }) => {
    const context = await projectContext(browser)
    const page = await context.newPage()
    const errors = collectErrors(page)
    await page.addInitScript(recordWorkers)
    const play = await openExample(page)
    const webCodecs = await page.evaluate(() => typeof AudioDecoder === 'function')
    test.skip(!webCodecs, 'no WebCodecs in this engine: the next test is its path')
    expect(await decodeWorkers(page)).not.toEqual([])
    await play.click()
    await expect(loopBadge(page)).toHaveText(/pass 1/, { timeout: 60_000 })
    expect(errors).toEqual([])
    await context.close()
  })

  test('with no optional capability at all, stems decode with decodeAudioData and the loop plays', async ({
    browser,
  }) => {
    const context = await projectContext(browser)
    const page = await context.newPage()
    const errors = collectErrors(page)
    const media: string[] = []
    page.on('request', (request) => {
      if (/\.(m4a|mp4|webm|opus)(\?|$)/.test(new URL(request.url()).pathname)) {
        media.push(request.url())
      }
    })
    await page.addInitScript(recordWorkers)
    await page.addInitScript(removeOptionalCapabilities)
    const play = await openExample(page)
    expect(
      await page.evaluate(() => ({
        webCodecs: 'AudioDecoder' in window,
        outputLatency: 'outputLatency' in AudioContext.prototype,
        wakeLock: 'wakeLock' in navigator,
        midi: 'requestMIDIAccess' in navigator,
      })),
    ).toEqual({ webCodecs: false, outputLatency: false, wakeLock: false, midi: false })
    // decodeAudioData, not the WebCodecs Worker.
    expect(await decodeWorkers(page)).toEqual([])
    // The clock runs on getOutputTimestamp() (or currentTime) alone: the loop wraps on time.
    await play.click()
    await expect(loopBadge(page)).toHaveText(/pass 1/, { timeout: 60_000 })
    // No Wake Lock: the "keep screen on" tip, from the first play.
    await expect(
      page.getByText("This browser can't keep your screen on.", { exact: false }),
    ).toBeVisible()
    // The stems are AAC in MP4; nothing asked for Opus.
    expect(media.length).toBeGreaterThan(0)
    expect(media.filter((url) => /webm|opus/.test(url))).toEqual([])
    expect(errors).toEqual([])
    await context.close()
  })
})

test.describe('signed in', () => {
  test.describe.configure({ mode: 'serial' })

  let context: BrowserContext

  test.beforeAll(async ({ browser }, info) => {
    context = await projectContext(browser)
    const page = await context.newPage()
    await signIn(page, `e2e-fallbacks-${info.project.name}-${Date.now()}@splitune.localhost`)
    await page.close()
  })

  test.afterAll(async () => {
    await context?.close()
  })

  async function importFile(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
    await page.goto('/import')
    await page.getByRole('tab', { name: 'File' }).click()
    await page.locator('input[type=file]').setInputFiles(file)
  }

  const AAC_FILE = () => ({ name: 'Take one.m4a', mimeType: 'audio/mp4', buffer: aac(4) })

  test('import: an AAC file previews through decodeAudioData when WebCodecs is missing', async () => {
    const page = await context.newPage()
    const errors = collectErrors(page)
    await page.addInitScript(() => Reflect.deleteProperty(window, 'AudioDecoder'))
    await importFile(page, AAC_FILE())
    await expect(
      page.getByRole('img', { name: /^Waveform of Take one\.m4a, 0:0[45]$/ }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Preview after upload')).toBeHidden()
    expect(errors).toEqual([])
    await page.close()
  })

  test('import: with no decoder at all the file waits for the server ("Preview after upload")', async () => {
    const page = await context.newPage()
    const errors = collectErrors(page)
    await page.addInitScript(removeAllDecoders)
    await importFile(page, AAC_FILE())
    await expect(page.getByText('Preview after upload')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Start practising' })).toBeEnabled()
    expect(errors).toEqual([])
    await page.close()
  })

  test('import: without MediaRecorder the Record tab says so and offers the others', async () => {
    const page = await context.newPage()
    await page.addInitScript(removeMediaRecorder)
    await page.goto('/import')
    await page.getByRole('tab', { name: 'Record' }).click()
    await expect(page.getByText("Recording isn't available in this browser.")).toBeVisible()
    await page.close()
  })

  for (const [requirement, remove, named] of [
    ['AudioWorklet', removeAudioWorklet, /AudioWorklet, which plays your stems in sync/],
    ['WebAssembly SIMD', removeWasmSimd, /WebAssembly SIMD, which slows music down/],
  ] as const) {
    test(`without ${requirement} practice shows the unsupported page and the library still opens`, async () => {
      const page = await context.newPage()
      await page.addInitScript(remove)
      await page.goto('/library')
      await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
      await page.goto(`/songs/${crypto.randomUUID()}/practice`)
      await expect(page).toHaveURL(/\/unsupported$/)
      await expect(
        page.getByRole('heading', { name: "Splitune can't run in this browser" }),
      ).toBeVisible()
      await expect(page.getByText(named)).toBeVisible()
      await page.getByRole('link', { name: 'Your library is still available' }).click()
      await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
      await page.close()
    })
  }
})
