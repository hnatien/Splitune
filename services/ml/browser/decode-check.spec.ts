// Browser decode check for stem encodes (05 `stems`: exact decoded length, zero offset).
// Fixtures come from the shipped encoder (scripts/decode_fixtures.py). Each file is decoded with
// decodeAudioData in a 44.1 kHz OfflineAudioContext (the PCM timeline rate, so no resampling of
// the AAC) and compared with the PCM it was made from. AAC must match exactly; Opus runs at
// 48 kHz, so its 44.1 kHz decode may round by one sample (the same bound stem_post verifies).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

type Expected = {
  aac_encoder: 'audiotoolbox' | 'ffmpeg'
  files: { file: string; codec: 'aac' | 'opus'; frames: number; pcm: string }[]
}

// DECODE_CHECK_DIR: check a real analysis's stems instead (scripts/fetch_stems.py writes the dir).
const { DECODE_CHECK_DIR } = process.env
const dir = DECODE_CHECK_DIR ?? mkdtempSync(join(tmpdir(), 'splitune-decode-'))
if (!DECODE_CHECK_DIR) {
  execFileSync('uv', ['run', 'python', 'scripts/decode_fixtures.py', dir], { stdio: 'inherit' })
}
const expected: Expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
const ORIGIN = 'http://decode.test'

test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/**`, (route) => {
    const name = new URL(route.request().url()).pathname.slice(1)
    if (name === '') return route.fulfill({ body: '<!doctype html><title>decode</title>' })
    return route.fulfill({ body: readFileSync(join(dir, name)) })
  })
  await page.goto(`${ORIGIN}/`)
})

for (const item of expected.files) {
  test(`${item.file} decodes to its ${item.frames} PCM frames at offset 0`, async ({
    page,
    browserName,
  }) => {
    test.fail(
      item.codec === 'opus' && browserName === 'chromium',
      'Chromium decodes Opus 22 samples early at 44.1 kHz: why the Opus variant is off by default',
    )
    test.fail(
      item.codec === 'aac' && browserName === 'webkit' && expected.aac_encoder === 'ffmpeg',
      'WebKit ignores the MP4 edit-list end trim; exact only with the AudioToolbox encoder',
    )
    const result = await page.evaluate(
      async ({ file, pcm }) => {
        const encoded = await (await fetch(`/${file}`)).arrayBuffer()
        const reference = new Float32Array(await (await fetch(`/${pcm}`)).arrayBuffer())
        const decoded = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(encoded)
        const left = decoded.getChannelData(0)
        const frames = reference.length / 2
        // Offset: best match of a 1 s window from the middle within ±256 samples.
        const start = Math.floor(frames / 2) - 22050
        let best = -Infinity
        let lag = 0
        for (let k = -256; k <= 256; k++) {
          let score = 0
          for (let i = start; i < start + 44100; i++)
            score += (left[i + k] ?? 0) * (reference[2 * i] ?? 0)
          if (score > best) {
            best = score
            lag = k
          }
        }
        return { length: decoded.length, rate: decoded.sampleRate, lag }
      },
      { file: item.file, pcm: item.pcm },
    )
    expect(result.rate).toBe(44100)
    expect(result.lag).toBe(0)
    if (item.codec === 'aac') expect(result.length).toBe(item.frames)
    else expect(Math.abs(result.length - item.frames)).toBeLessThanOrEqual(1)
  })
}
